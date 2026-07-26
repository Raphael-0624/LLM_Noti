import type { AppData, Tool } from '../types'
import { lastDueReset } from '../storage'

function remaining(t: Tool) {
  return Math.max(0, t.quota - t.used)
}

function isExpired(t: Tool, now: Date) {
  return t.billing === 'paid' && !!t.validTo && new Date(t.validTo + 'T23:59:59') < now
}

function isUsable(t: Tool, now: Date) {
  return remaining(t) > 0 && !isExpired(t, now)
}

function resetLabel(t: Tool, now: Date): string {
  if (t.reset.kind === 'manual') return '手动重置'
  const due = lastDueReset(t, now)!
  const next = new Date(due)
  next.setDate(next.getDate() + 1)
  const mins = Math.round((next.getTime() - now.getTime()) / 60_000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const hhmm = `${String(t.reset.hour).padStart(2, '0')}:${String(t.reset.minute).padStart(2, '0')}`
  return `${hhmm} 重置 · 还剩 ${h}h${m}m`
}

function paidLabel(t: Tool, now: Date): string {
  if (!t.validTo) return '付费'
  if (isExpired(t, now)) return '已过期'
  const days = Math.ceil((new Date(t.validTo + 'T23:59:59').getTime() - now.getTime()) / 86_400_000)
  return `有效期至 ${t.validTo} · 剩 ${days} 天`
}

function ToolCard({ tool, now, onLog, onReset }: {
  tool: Tool
  now: Date
  onLog: (t: Tool) => void
  onReset: (t: Tool) => void
}) {
  const rest = remaining(tool)
  const pct = tool.quota > 0 ? Math.min(100, (tool.used / tool.quota) * 100) : 0
  const usable = isUsable(tool, now)
  const low = usable && pct >= 80
  return (
    <div className={`card ${usable ? '' : 'depleted'}`}>
      <div className="card-head">
        <span className="tool-name">
          {tool.url ? <a href={tool.url} target="_blank" rel="noreferrer">{tool.name}</a> : tool.name}
        </span>
        <span className={`badge ${tool.billing}`}>{tool.billing === 'free' ? '免费' : '付费'}</span>
      </div>
      <div className="quota-line">
        <b>{rest}</b> / {tool.quota} {tool.unit}
        {low && <span className="low-tag">告急</span>}
        {!usable && <span className="depleted-tag">{isExpired(tool, now) ? '已过期' : '已用尽'}</span>}
      </div>
      <div className="bar"><div className={`bar-fill ${low ? 'low' : ''}`} style={{ width: `${pct}%` }} /></div>
      <div className="card-meta">
        {tool.billing === 'free' ? resetLabel(tool, now) : paidLabel(tool, now)}
      </div>
      <div className="card-actions">
        <button className="primary" onClick={() => onLog(tool)}>记一笔</button>
        {tool.reset.kind === 'manual' && <button onClick={() => onReset(tool)}>重置额度</button>}
      </div>
    </div>
  )
}

export function Dashboard({ data, onLog, onReset, onGoConfig }: {
  data: AppData
  onLog: (t: Tool) => void
  onReset: (t: Tool) => void
  onGoConfig: () => void
}) {
  const now = new Date()
  if (data.tools.length === 0) {
    return (
      <div className="empty">
        <p>还没有配置任何工具。</p>
        <button className="primary" onClick={onGoConfig}>去添加第一个工具</button>
      </div>
    )
  }
  const categories = data.categories.filter((c) => data.tools.some((t) => t.category === c))
  const uncategorized = data.tools.filter((t) => !data.categories.includes(t.category))
  return (
    <div className="dashboard">
      {categories.map((cat) => {
        const tools = data.tools
          .filter((t) => t.category === cat)
          .sort((a, b) => Number(isUsable(b, now)) - Number(isUsable(a, now)))
        return (
          <section key={cat}>
            <h2>{cat}</h2>
            <div className="cards">
              {tools.map((t) => <ToolCard key={t.id} tool={t} now={now} onLog={onLog} onReset={onReset} />)}
            </div>
          </section>
        )
      })}
      {uncategorized.length > 0 && (
        <section>
          <h2>未分类</h2>
          <div className="cards">
            {uncategorized.map((t) => <ToolCard key={t.id} tool={t} now={now} onLog={onLog} onReset={onReset} />)}
          </div>
        </section>
      )}
    </div>
  )
}
