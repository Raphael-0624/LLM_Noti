import type { AppData, QuotaPool, Tool } from '../types'
import { nextResetAt, poolRemaining, toolRemaining } from '../storage'

function isExpired(t: Tool, now: Date) {
  return !!t.validTo && new Date(t.validTo + 'T23:59:59') < now
}

function isUsable(t: Tool, now: Date) {
  if (isExpired(t, now)) return false
  return t.unlimited || toolRemaining(t) > 0
}

function resetLabel(p: QuotaPool, now: Date): string | null {
  const r = p.reset
  if (r.kind === 'manual') return null
  const next = nextResetAt(r, now)!
  if (r.kind === 'daily') {
    const mins = Math.max(0, Math.round((next.getTime() - now.getTime()) / 60_000))
    const hhmm = `${String(r.hour).padStart(2, '0')}:${String(r.minute).padStart(2, '0')}`
    return `${p.label} ${hhmm} 重置 · 还剩 ${Math.floor(mins / 60)}h${mins % 60}m`
  }
  const days = Math.ceil((next.getTime() - now.getTime()) / 86_400_000)
  return `${p.label}每月${r.day}日重置 · 还剩 ${days} 天`
}

function validityLabel(t: Tool, now: Date): string | null {
  if (!t.validTo) return null
  if (isExpired(t, now)) return '已过期'
  const days = Math.ceil((new Date(t.validTo + 'T23:59:59').getTime() - now.getTime()) / 86_400_000)
  return `有效期至 ${t.validTo} · 剩 ${days} 天`
}

function PoolRow({ pool, unit, showLabel }: { pool: QuotaPool; unit: string; showLabel: boolean }) {
  const rest = poolRemaining(pool)
  const pct = pool.quota > 0 ? Math.min(100, (pool.used / pool.quota) * 100) : 0
  const low = rest > 0 && pct >= 80
  return (
    <div className="pool-row">
      <div className="quota-line">
        {showLabel && <span className="pool-label">{pool.label}</span>}
        <b>{rest}</b> / {pool.quota} {unit}
        {low && <span className="low-tag">告急</span>}
        {rest <= 0 && <span className="depleted-tag">已用尽</span>}
      </div>
      <div className="bar"><div className={`bar-fill ${low ? 'low' : ''}`} style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

function ToolCard({ tool, now, onPick }: {
  tool: Tool
  now: Date
  onPick: (t: Tool) => void
}) {
  const usable = isUsable(tool, now)
  const meta = [
    ...tool.pools.map((p) => resetLabel(p, now)).filter(Boolean).slice(0, 1),
    validityLabel(tool, now),
  ].filter(Boolean)
  return (
    <div
      className={`card ${usable ? '' : 'depleted'}`}
      role="button"
      tabIndex={0}
      aria-label={`${tool.name}，点击记一笔`}
      onClick={() => onPick(tool)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(tool) } }}
    >
      <div className="card-head">
        <span className="tool-name">
          {tool.url
            ? <a href={tool.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{tool.name}</a>
            : tool.name}
        </span>
        <span className={`badge ${tool.billing}`}>{tool.billing === 'free' ? '免费' : '付费'}</span>
      </div>
      {tool.unlimited ? (
        <div className="quota-line unlimited-line">
          <b>∞</b> 不限量
          {isExpired(tool, now) && <span className="depleted-tag">已过期</span>}
        </div>
      ) : (
        tool.pools.map((p, i) => (
          <PoolRow key={i} pool={p} unit={tool.unit} showLabel={tool.pools.length > 1} />
        ))
      )}
      {meta.length > 0 && <div className="card-meta">{meta.join(' · ')}</div>}
    </div>
  )
}

export function Dashboard({ data, onPick, onGoConfig }: {
  data: AppData
  onPick: (t: Tool) => void
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
              {tools.map((t) => <ToolCard key={t.id} tool={t} now={now} onPick={onPick} />)}
            </div>
          </section>
        )
      })}
      {uncategorized.length > 0 && (
        <section>
          <h2>未分类</h2>
          <div className="cards">
            {uncategorized.map((t) => <ToolCard key={t.id} tool={t} now={now} onPick={onPick} />)}
          </div>
        </section>
      )}
    </div>
  )
}
