import { useMemo, useState } from 'react'
import type { Tool } from '../types'

export function QuickLogSheet({ tools, initialTool, onSubmit, onClose }: {
  tools: Tool[]
  initialTool: Tool | null
  onSubmit: (tool: Tool, amount: number, task: string) => void
  onClose: () => void
}) {
  const [toolId, setToolId] = useState<string | null>(initialTool?.id ?? null)
  const [task, setTask] = useState('')
  const [amount, setAmount] = useState('1')

  const tool = tools.find((t) => t.id === toolId) ?? null
  const n = Number(amount)
  const valid = !!tool && Number.isFinite(n) && n > 0

  // 有剩余额度的排前面，用尽的置灰但仍可选（比如补记）
  const sorted = useMemo(
    () => [...tools].sort((a, b) => Number(b.quota - b.used > 0) - Number(a.quota - a.used > 0)),
    [tools],
  )

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>记一笔</h3>
        <label>
          做了什么任务（可选）
          <input
            autoFocus={!initialTool}
            type="text"
            placeholder="比如：给周报生成配图"
            value={task}
            onChange={(e) => setTask(e.target.value)}
          />
        </label>
        <div className="field">
          <span className="field-label">用的哪个工具</span>
          <div className="chips">
            {sorted.map((t) => {
              const rest = Math.max(0, t.quota - t.used)
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`chip ${toolId === t.id ? 'on' : ''} ${rest <= 0 ? 'dim' : ''}`}
                  onClick={() => setToolId(t.id)}
                >
                  {t.name}<i>{rest}{t.unit}</i>
                </button>
              )
            })}
          </div>
        </div>
        {tool && (
          <label>
            消耗量（{tool.unit}）
            <div className="stepper">
              <button type="button" aria-label="减少" onClick={() => setAmount(String(Math.max(0, (Number(amount) || 0) - 1)))}>−</button>
              <input type="number" min="0" step="any" inputMode="decimal" value={amount}
                onChange={(e) => setAmount(e.target.value)} />
              <button type="button" aria-label="增加" onClick={() => setAmount(String((Number(amount) || 0) + 1))}>+</button>
            </div>
          </label>
        )}
        <div className="modal-actions">
          <button onClick={onClose}>取消</button>
          <button className="primary" disabled={!valid} onClick={() => valid && onSubmit(tool!, n, task)}>记录</button>
        </div>
      </div>
    </div>
  )
}
