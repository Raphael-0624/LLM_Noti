import { useMemo, useRef, useState } from 'react'
import type { AppData, QuotaPool, Tool } from '../types'
import { DEFAULT_UNITS, POOL_BALANCE, POOL_DAILY_FREE, POOL_DEFAULT } from '../types'
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
  unlimited: 'no' as 'yes' | 'no', unit: '次', quota: '10',
  resetKind: 'daily' as 'daily' | 'monthly' | 'manual',
  resetTime: '00:00', resetDay: '1',
  freeExtra: 'no' as 'yes' | 'no', freeQuota: '100', freeTime: '00:00',
  validFrom: '', validTo: '',
}
type FormState = typeof EMPTY

function toForm(t: Tool): FormState {
  const main = t.pools[0]
  const free = t.pools[1]
  const r = main?.reset
  return {
    name: t.name, url: t.url ?? '', category: t.category, billing: t.billing,
    unlimited: t.unlimited ? 'yes' : 'no',
    unit: t.unit,
    quota: main ? String(main.quota) : '10',
    resetKind: r && r.kind !== 'manual' ? r.kind : r ? 'manual' : 'daily',
    resetTime: r && r.kind !== 'manual'
      ? `${String(r.hour).padStart(2, '0')}:${String(r.minute).padStart(2, '0')}`
      : '00:00',
    resetDay: r?.kind === 'monthly' ? String(r.day) : '1',
    freeExtra: free ? 'yes' : 'no',
    freeQuota: free ? String(free.quota) : '100',
    freeTime: free && free.reset.kind === 'daily'
      ? `${String(free.reset.hour).padStart(2, '0')}:${String(free.reset.minute).padStart(2, '0')}`
      : '00:00',
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

  function buildPools(prev: QuotaPool[]): QuotaPool[] {
    const now = new Date().toISOString()
    const quota = Number(form.quota)
    const [h, m] = form.resetTime.split(':').map(Number)
    const day = Math.min(31, Math.max(1, Number(form.resetDay) || 1))
    const mainReset: QuotaPool['reset'] =
      form.resetKind === 'manual' ? { kind: 'manual' }
        : form.resetKind === 'monthly' ? { kind: 'monthly', day, hour: h || 0, minute: m || 0 }
          : { kind: 'daily', hour: h || 0, minute: m || 0 }
    const pools: QuotaPool[] = [{
      label: form.freeExtra === 'yes' ? POOL_BALANCE : POOL_DEFAULT,
      quota,
      used: prev[0]?.used ?? 0,
      reset: mainReset,
      lastReset: prev[0]?.lastReset ?? now,
    }]
    if (form.freeExtra === 'yes') {
      const [fh, fm] = form.freeTime.split(':').map(Number)
      pools.push({
        label: POOL_DAILY_FREE,
        quota: Number(form.freeQuota) || 0,
        used: prev[1]?.used ?? 0,
        reset: { kind: 'daily', hour: fh || 0, minute: fm || 0 },
        lastReset: prev[1]?.lastReset ?? now,
      })
    }
    return pools
  }

  function submit() {
    const unlimited = form.unlimited === 'yes'
    const quota = Number(form.quota)
    if (!form.name.trim()) return
    if (!unlimited && (!Number.isFinite(quota) || quota <= 0)) return
    const base = {
      name: form.name.trim(),
      url: form.url.trim() || undefined,
      category: form.category,
      billing: form.billing,
      unit: form.unit,
      unlimited,
      validFrom: form.validFrom || undefined,
      validTo: form.validTo || undefined,
    }
    setData((d) => {
      let tools: Tool[]
      if (editing === 'new') {
        const tool: Tool = {
          ...base, id: uid(), pools: unlimited ? [] : buildPools([]), createdAt: new Date().toISOString(),
        }
        tools = [...d.tools, tool]
      } else {
        const id = (editing as Tool).id
        tools = d.tools.map((t) =>
          t.id === id ? { ...t, ...base, pools: unlimited ? [] : buildPools(t.pools) } : t,
        )
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
    if (!confirm(`把「${tool.name}」所有额度的已用量清零？`)) return
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

  function quotaSummary(t: Tool): string {
    if (t.unlimited) return '不限量'
    return t.pools.map((p) => `${p.label} ${p.quota}${t.unit}`).join(' + ')
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
            <div className="field">
              <span className="field-label">额度模式</span>
              <Chips options={[
                { value: 'no', label: '按额度计量' },
                { value: 'yes', label: '不限量（只记任务）' },
              ]} value={form.unlimited} onChange={(v) => set({ unlimited: v as 'yes' | 'no' })} />
            </div>
            {form.unlimited === 'no' && (
              <>
                <div className="field">
                  <span className="field-label">单位</span>
                  <Chips options={DEFAULT_UNITS.map((u) => ({ value: u, label: u }))}
                    value={form.unit} onChange={(v) => set({ unit: v })} />
                </div>
                <div className="form-row">
                  <label>{form.freeExtra === 'yes' ? '余额（充值/一次性）*' : '额度 *'}
                    <input type="number" min="0" step="any" inputMode="decimal" value={form.quota}
                      onChange={(e) => set({ quota: e.target.value })} />
                  </label>
                </div>
                <div className="field">
                  <span className="field-label">这部分额度的自动重置</span>
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
                <div className="field">
                  <span className="field-label">另有每日免费额度？</span>
                  <Chips options={[
                    { value: 'no', label: '没有' },
                    { value: 'yes', label: '有（每天刷新）' },
                  ]} value={form.freeExtra} onChange={(v) => set({ freeExtra: v as 'yes' | 'no' })} />
                </div>
                {form.freeExtra === 'yes' && (
                  <div className="form-row">
                    <label>每日免费额度
                      <input type="number" min="0" step="any" inputMode="decimal" value={form.freeQuota}
                        onChange={(e) => set({ freeQuota: e.target.value })} />
                    </label>
                    <label>刷新时刻
                      <input type="time" value={form.freeTime} onChange={(e) => set({ freeTime: e.target.value })} />
                    </label>
                  </div>
                )}
              </>
            )}
            <div className="form-row">
              <label>有效期从（可选）
                <input type="date" value={form.validFrom} onChange={(e) => set({ validFrom: e.target.value })} />
              </label>
              <label>有效期至（可选）
                <input type="date" value={form.validTo} onChange={(e) => set({ validTo: e.target.value })} />
              </label>
            </div>
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
                {t.category} · {t.billing === 'free' ? '免费' : '付费'} · {quotaSummary(t)} · 使用过 {usedDays.get(t.id)?.size ?? 0} 天
              </span>
            </div>
            <span className="spacer" />
            {!t.unlimited && <button onClick={() => manualReset(t)}>重置</button>}
            <button onClick={() => openEdit(t)}>编辑</button>
            <button className="danger" onClick={() => remove(t)}>删除</button>
          </li>
        ))}
      </ul>
      {data.tools.length === 0 && !editing && <div className="empty"><p>还没有工具，点「添加工具」开始配置。</p></div>}
    </div>
  )
}
