import { useRef, useState } from 'react'
import type { AppData, Tool } from '../types'
import { DEFAULT_UNITS } from '../types'
import { exportJson, importJson, uid } from '../storage'

const EMPTY = {
  name: '', url: '', category: '', billing: 'free' as Tool['billing'],
  unit: '次', quota: '10', resetKind: 'daily' as 'daily' | 'manual',
  resetTime: '00:00', validFrom: '', validTo: '',
}
type FormState = typeof EMPTY

function toForm(t: Tool): FormState {
  return {
    name: t.name, url: t.url ?? '', category: t.category, billing: t.billing,
    unit: t.unit, quota: String(t.quota),
    resetKind: t.reset.kind === 'daily' ? 'daily' : 'manual',
    resetTime: t.reset.kind === 'daily'
      ? `${String(t.reset.hour).padStart(2, '0')}:${String(t.reset.minute).padStart(2, '0')}`
      : '00:00',
    validFrom: t.validFrom ?? '', validTo: t.validTo ?? '',
  }
}

export function ToolManager({ data, setData }: {
  data: AppData
  setData: (fn: (d: AppData) => AppData) => void
}) {
  const [editing, setEditing] = useState<Tool | 'new' | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }))

  function openNew() {
    setForm(EMPTY)
    setEditing('new')
  }

  function openEdit(t: Tool) {
    setForm(toForm(t))
    setEditing(t)
  }

  function submit() {
    const quota = Number(form.quota)
    if (!form.name.trim() || !Number.isFinite(quota) || quota <= 0) return
    const [h, m] = form.resetTime.split(':').map(Number)
    const reset: Tool['reset'] = form.billing === 'paid' || form.resetKind === 'manual'
      ? { kind: 'manual' }
      : { kind: 'daily', hour: h || 0, minute: m || 0 }
    const base = {
      name: form.name.trim(),
      url: form.url.trim() || undefined,
      category: form.category.trim() || '其他',
      billing: form.billing,
      unit: form.unit.trim() || '次',
      quota,
      reset,
      validFrom: form.billing === 'paid' ? form.validFrom || undefined : undefined,
      validTo: form.billing === 'paid' ? form.validTo || undefined : undefined,
    }
    setData((d) => {
      let tools: Tool[]
      let categories = d.categories
      if (editing === 'new') {
        const tool: Tool = { ...base, id: uid(), used: 0, lastReset: new Date().toISOString(), createdAt: new Date().toISOString() }
        tools = [...d.tools, tool]
      } else {
        tools = d.tools.map((t) => (t.id === (editing as Tool).id ? { ...t, ...base } : t))
      }
      if (!categories.includes(base.category)) categories = [...categories, base.category]
      return { ...d, tools, categories }
    })
    setEditing(null)
  }

  function remove(tool: Tool) {
    if (!confirm(`删除「${tool.name}」？使用记录会保留在历史里。`)) return
    setData((d) => ({ ...d, tools: d.tools.filter((t) => t.id !== tool.id) }))
  }

  function doExport() {
    const blob = new Blob([exportJson(data)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `llm-noti-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function doImport(file: File) {
    file.text().then((raw) => {
      try {
        const imported = importJson(raw)
        if (confirm('导入会覆盖当前全部数据，确定？')) setData(() => imported)
      } catch (e) {
        alert(`导入失败：${(e as Error).message}`)
      }
    })
  }

  return (
    <div className="tool-manager">
      <div className="manager-bar">
        <button className="primary" onClick={openNew}>添加工具</button>
        <span className="spacer" />
        <button onClick={doExport}>导出 JSON</button>
        <button onClick={() => fileRef.current?.click()}>导入 JSON</button>
        <input ref={fileRef} type="file" accept=".json" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = '' }} />
      </div>

      {editing && (
        <div className="tool-form">
          <h3>{editing === 'new' ? '添加工具' : `编辑 · ${(editing as Tool).name}`}</h3>
          <div className="form-grid">
            <label>名称 *<input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="比如 Claude / 即梦 / DeepSeek API" /></label>
            <label>链接<input value={form.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" /></label>
            <label>分类
              <input list="categories" value={form.category} onChange={(e) => set({ category: e.target.value })} placeholder="选择或输入新分类" />
              <datalist id="categories">{data.categories.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
            <label>计费类型
              <select value={form.billing} onChange={(e) => set({ billing: e.target.value as Tool['billing'] })}>
                <option value="free">免费（按周期重置）</option>
                <option value="paid">付费（有效期 + 总量）</option>
              </select>
            </label>
            <label>{form.billing === 'free' ? '每周期额度 *' : '总量 *'}
              <input type="number" min="0" step="any" value={form.quota} onChange={(e) => set({ quota: e.target.value })} />
            </label>
            <label>单位
              <input list="units" value={form.unit} onChange={(e) => set({ unit: e.target.value })} />
              <datalist id="units">{DEFAULT_UNITS.map((u) => <option key={u} value={u} />)}</datalist>
            </label>
            {form.billing === 'free' ? (
              <>
                <label>重置方式
                  <select value={form.resetKind} onChange={(e) => set({ resetKind: e.target.value as 'daily' | 'manual' })}>
                    <option value="daily">每日定时</option>
                    <option value="manual">手动重置</option>
                  </select>
                </label>
                {form.resetKind === 'daily' && (
                  <label>重置时刻
                    <input type="time" value={form.resetTime} onChange={(e) => set({ resetTime: e.target.value })} />
                  </label>
                )}
              </>
            ) : (
              <>
                <label>有效期从<input type="date" value={form.validFrom} onChange={(e) => set({ validFrom: e.target.value })} /></label>
                <label>有效期至<input type="date" value={form.validTo} onChange={(e) => set({ validTo: e.target.value })} /></label>
              </>
            )}
          </div>
          <div className="modal-actions">
            <button onClick={() => setEditing(null)}>取消</button>
            <button className="primary" onClick={submit}>保存</button>
          </div>
        </div>
      )}

      <ul className="tool-list">
        {data.tools.map((t) => (
          <li key={t.id}>
            <span className="tool-name">{t.name}</span>
            <span className="tool-info">{t.category} · {t.billing === 'free' ? '免费' : '付费'} · {t.quota} {t.unit}</span>
            <span className="spacer" />
            <button onClick={() => openEdit(t)}>编辑</button>
            <button className="danger" onClick={() => remove(t)}>删除</button>
          </li>
        ))}
      </ul>
      {data.tools.length === 0 && !editing && <div className="empty"><p>还没有工具，点「添加工具」开始配置。</p></div>}
    </div>
  )
}
