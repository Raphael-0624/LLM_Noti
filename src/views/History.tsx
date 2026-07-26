import { useEffect, useMemo, useRef, useState } from 'react'
import type { Tool, UsageLog } from '../types'

/** 本地时区的 yyyy-mm-dd，避免 UTC 日期在凌晨归错天 */
function localDay(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const WEEKS = 26

/** 笔数 → 色阶：0 空，1 笔，2-3 笔，4-6 笔，7+ 笔 */
function level(count: number): number {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (count <= 3) return 2
  if (count <= 6) return 3
  return 4
}

function Heatmap({ counts, picked, onPick }: {
  counts: Map<string, number>
  picked: string | null
  onPick: (day: string | null) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const weeks = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dow = (today.getDay() + 6) % 7 // 0 = 周一
    const start = new Date(today)
    start.setDate(start.getDate() - dow - 7 * (WEEKS - 1))
    const result: { key: string; date: Date; future: boolean }[][] = []
    const d = new Date(start)
    for (let w = 0; w < WEEKS; w++) {
      const week: { key: string; date: Date; future: boolean }[] = []
      for (let i = 0; i < 7; i++) {
        week.push({ key: dayKey(d), date: new Date(d), future: d > today })
        d.setDate(d.getDate() + 1)
      }
      result.push(week)
    }
    return result
  }, [])

  // 默认滚到最右（最近的日期）
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [])

  return (
    <div className="heatmap">
      <div className="hm-scroll" ref={scrollRef}>
        <div>
          <div className="hm-months">
            {weeks.map((week, i) => {
              const first = week[0].date
              const label = first.getDate() <= 7 ? `${first.getMonth() + 1}月` : ''
              return <span key={i}>{label}</span>
            })}
          </div>
          <div className="hm-grid">
            {weeks.map((week, i) => (
              <div className="hm-col" key={i}>
                {week.map((cell) => {
                  if (cell.future) return <i key={cell.key} className="hm-cell future" />
                  const n = counts.get(cell.key) ?? 0
                  const label = `${cell.date.getMonth() + 1}月${cell.date.getDate()}日，${n} 笔记录`
                  return (
                    <button
                      key={cell.key}
                      className={`hm-cell l${level(n)} ${picked === cell.key ? 'picked' : ''}`}
                      title={label}
                      aria-label={label}
                      onClick={() => onPick(picked === cell.key ? null : n > 0 ? cell.key : null)}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="hm-legend">
        <span>少</span>
        {[0, 1, 2, 3, 4].map((l) => <i key={l} className={`hm-cell l${l}`} />)}
        <span>多</span>
      </div>
    </div>
  )
}

export function History({ logs, toolById }: {
  logs: UsageLog[]
  toolById: Map<string, Tool>
}) {
  const [picked, setPicked] = useState<string | null>(null)

  const byDay = useMemo(() => {
    const map = new Map<string, UsageLog[]>()
    for (const log of logs) {
      const day = localDay(log.at)
      const list = map.get(day) ?? []
      list.push(log)
      map.set(day, list)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [logs])

  const counts = useMemo(() => new Map(byDay.map(([day, list]) => [day, list.length])), [byDay])

  if (logs.length === 0) return <div className="empty"><p>还没有使用记录。在看板上点「记一笔」开始。</p></div>

  const shown = picked ? byDay.filter(([day]) => day === picked) : byDay

  return (
    <div className="history">
      <Heatmap counts={counts} picked={picked} onPick={setPicked} />
      {picked && (
        <div className="hm-filter-bar">
          只看 {picked}
          <button onClick={() => setPicked(null)}>显示全部</button>
        </div>
      )}
      {shown.map(([day, list]) => (
        <section key={day}>
          <h2>{day} <span className="day-count">{list.length} 笔</span></h2>
          <ul>
            {list.map((log) => {
              const tool = toolById.get(log.toolId)
              return (
                <li key={log.id}>
                  <span className="log-time">{new Date(log.at).toTimeString().slice(0, 5)}</span>
                  <span className="log-tool">{tool?.name ?? '（已删除的工具）'}</span>
                  <span className="log-amount">-{log.amount} {tool?.unit ?? ''}</span>
                  <span className="log-task">{log.task ?? ''}</span>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
