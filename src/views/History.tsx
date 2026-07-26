import { useMemo } from 'react'
import type { Tool, UsageLog } from '../types'

export function History({ logs, toolById }: {
  logs: UsageLog[]
  toolById: Map<string, Tool>
}) {
  const byDay = useMemo(() => {
    const map = new Map<string, UsageLog[]>()
    for (const log of logs) {
      const day = log.at.slice(0, 10)
      const list = map.get(day) ?? []
      list.push(log)
      map.set(day, list)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [logs])

  if (logs.length === 0) return <div className="empty"><p>还没有使用记录。在看板上点「记一笔」开始。</p></div>

  return (
    <div className="history">
      {byDay.map(([day, list]) => (
        <section key={day}>
          <h2>{day}</h2>
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
