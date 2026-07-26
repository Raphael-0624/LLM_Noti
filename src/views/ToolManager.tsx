import { useMemo, useRef, useState } from 'react'
import type { AppData, Tool } from '../types'
import { DEFAULT_UNITS } from '../types'
import { exportJson, importJson, localDay, uid } from '../storage'

function Chips({ options, value, onChange }: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o.value} type="button"
          className={`chip ${value === o.value ? 'on' : ''}`}
          onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

const EMPTY = {
  name: '', url: '', category: '其他', billing: 'free' as Tool['billing'],
  unit: '次', quota: '10', resetKind: 'daily' as 'daily' | 'monthly' | 'manual',
  resetTime: '00:00', resetDay: '1', validFrom: '', validTo: '',
}
type FormState = typeof EMPTY

function toForm(t: Tool): FormState {
  const r = t.reset
  return {
    name: t.name, url: t.url ?? '', category: t.category, billing: t.billing,
    unit: t.unit, quota: String(t.quota),
    resetKind: r.kind,
    resetTime: r.kind === 'manual' ? '00:00'
      : `${String(r.hour).padStart(2, '0')}:${String(r.minute).padStart(2, '0')}`,
    resetDay: r.kind === 'monthly' ? String(r.day) : '1',
    validFrom: t.validFrom ?? '', validTo: t.validTo ?? '',
  }
}

export function ToolManager({ data, setData, onReset }: {
  data: AppData
  setData: (fn: (d: AppData) => AppData) => void
  onReset: (t: Tool) => void
}) {
  const [editing, setEditing] = useState<Tool | 'new' | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }))

  // 每个工具历史上有记录的天数
  const usedDays = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const log of data.logs) {
      const s = map.get(log.toolId) ?? new Set<string>()
      s.add(localDay(log.at))
      map.set(log.toolId, s)
    }
    return map
  }, [data.logs])

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
    const day = Math.min(31, Math.max(1, Number(form.resetDay) || 1))
    const reset: Tool['reset'] =
      form.billing === 'paid' || form.resetKind === 'manual' ? { kind: 'manual' }
        : form.resetKind === 'monthly' ? { kind: 'monthly', day, hour: h || 0, minute: m || 0 }
          : { kind: 'daily', hour: h || 0, minute: m || 0 }
    const base = {
      name: form.name.trim(),
      url: form.url.trim() || undefined,
      category: form.category,
      billing: form.billing,
      unit: form.unit,
      quota,
      reset,
      validFrom: form.billing === 'paid' ? form.validFrom || undefined : undefined,
      validTo: form.billing === 'paid' ? form.validTo || undefined : undefined,
    }
    setData((d) => {
      let tools: Tool[]
      if (editing === 'new') {
        const tool: Tool = { ...base, id: uid(), used: 0, lastReset: new Date().toISOString(), createdAt: new Date().toISOString() }
        tools = [...d.tools, tool]
      } else {
        tools = d.tools.map((t) => (t.id === (editing as Tool).id ? { ...t, ...base } : t))
      }
      return { ...d, tools }
    })
    setEditing(null)
  }

  function remove(tool: Tool) {
    if (!confirm(`删除「${tool.name}」？使用记录会保留在历史里。`)) return
    setData((d) => ({ ...d, tools: d.tools.filter((t) => t.id !== tool.id) }))
  }

  function manualReset(tool: Tool) {
    if (!confirm(`把「${tool.name}」的已用量清零？`)) return
    onReset(tool)
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
        <div className="modal-mask" onClick={() => setEditing(null)}>
          <div className="modal form-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing === 'new' ? '添加工具' : `编辑 · ${(editing as Tool).name}`}</h3>
            <label>名称 *
              <input value={form.name} onChange={(e) => set({ name: e.target.value })}
                placeholder="比如 Claude / 即梦 / DeepSeek API" />
            </label>
            <label>链接
              <input value={form.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" />
            </label>
            <div className="field">
              <span className="field-label">分类</span>
              <Chips options={data.categories.map((c) => ({ value: c, label: c }))}
                value={form.category} onChange={(v) => set({ category: v })} />
            </div>
            <div className="field">
              <span className="field-label">计费类型</span>
              <Chips options={[{ value: 'free', label: '免费' }, { value: 'paid', label: '付费' }]}
                value={form.billing} onChange={(v) => set({ billing: v as Tool['billing'] })} />
            </div>
            <div className="form-row">
              <label>{form.billing === 'free' ? '每周期额度 *' : '总量 *'}
                <input type="number" min="0" step="any" inputMode="decimal" value={form.quota}
                  onChange={(e) => set({ quota: e.target.value })} />
              </label>
            </div>
            <div className="field">
              <span className="field-label">单位</span>
              <Chips options={DEFAULT_UNITS.map((u) => ({ value: u, label: u }))}
                value={form.unit} onChange={(v) => set({ unit: v })} />
            </div>
            {form.billing === 'free' ? (
              <>
                <div className="field">
                  <span className="field-label">自动重置</span>
                  <Chips options={[
                    { value: 'daily', label: '每日' },
                    { value: 'monthly', label: '每月' },
                    { value: 'manual', label: '不自动' },
                  ]} value={form.resetKind} onChange={(v) => set({ resetKind: v as FormState['resetKind'] })} />
                </div>
                {form.resetKind !== 'manual' && (
                  <div className="form-row">
                    {form.resetKind === 'monthly' && (
                      <label>每月几号
                        <input type="number" min="1" max="31" inputMode="numeric" value={form.resetDay}
                          onChange={(e) => set({ resetDay: e.target.value })} />
                      </label>
                    )}
                    <label>重置时刻
                      <input type="time" value={form.resetTime} onChange={(e) => set({ resetTime: e.target.value })} />
                    </label>
                  </div>
                )}
              </>
            ) : (
              <div className="form-row">
                <label>有效期从
                  <input type="date" value={form.validFrom} onChange={(e) => set({ validFrom: e.target.value })} />
                </label>
                <label>有效期至
                  <input type="date" value={form.validTo} onChange={(e) => set({ validTo: e.target.value })} />
                </label>
              </div>
            )}
            <div className="modal-actions">
              <button onClick={() => setEditing(null)}>取消</button>
              <button className="primary" onClick={submit}>保存</button>
            </div>
          </div>
        </div>
      )}

      <ul className="tool-list">
        {data.tools.map((t) => (
          <li key={t.id}>
            <div className="tool-cell">
              <span className="tool-name">{t.name}</span>
              <span className="tool-info">
                {t.category} · {t.billing === 'free' ? '免费' : '付费'} · {t.quota} {t.unit} · 使用过 {usedDays.get(t.id)?.size ?? 0} 天
              </span>
            </div>
            <span className="spacer" />
            <button onClick={() => manualReset(t)}>重置</button>
            <button onClick={() => openEdit(t)}>编辑</button>
            <button className="danger" onClick={() => remove(t)}>删除</button>
          </li>
        ))}
      </ul>
      {data.tools.length === 0 && !editing && <div className="empty"><p>还没有工具，点「添加工具」开始配置。</p></div>}
    </div>
  )
}
