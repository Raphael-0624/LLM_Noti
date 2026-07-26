import { useMemo, useState } from 'react'
import type { Tool } from '../types'
import { poolRemaining, toolRemaining } from '../storage'

/** 默认扣哪个池：优先有余量的自动重置池（每日免费），其次任何有余量的池 */
function defaultPool(tool: Tool): number {
  const auto = tool.pools.findIndex((p) => p.reset.kind !== 'manual' && poolRemaining(p) > 0)
  if (auto >= 0) return auto
  const any = tool.pools.findIndex((p) => poolRemaining(p) > 0)
  return any >= 0 ? any : 0
}

export function QuickLogSheet({ tools, initialTool, onSubmit, onClose }: {
  tools: Tool[]
  initialTool: Tool | null
  onSubmit: (tool: Tool, poolIndex: number, amount: number, task: string) => void
  onClose: () => void
}) {
  const [toolId, setToolId] = useState<string | null>(initialTool?.id ?? null)
  const [poolIdx, setPoolIdx] = useState<number>(initialTool ? defaultPool(initialTool) : 0)
  const [task, setTask] = useState('')
  const [amount, setAmount] = useState('1')

  const tool = tools.find((t) => t.id === toolId) ?? null
  const n = Number(amount)
  const valid = !!tool && (tool.unlimited || (Number.isFinite(n) && n > 0))

  // 有剩余额度的排前面，用尽的置灰但仍可选（比如补记）
  const sorted = useMemo(
    () => [...tools].sort((a, b) => Number(toolRemaining(b) > 0) - Number(toolRemaining(a) > 0)),
    [tools],
  )

  function pickTool(t: Tool) {
    setToolId(t.id)
    setPoolIdx(defaultPool(t))
  }

  function submit() {
    if (!tool) return
    if (tool.unlimited) onSubmit(tool, -1, 0, task)
    else onSubmit(tool, poolIdx, n, task)
  }

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
              const rest = toolRemaining(t)
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`chip ${toolId === t.id ? 'on' : ''} ${rest <= 0 ? 'dim' : ''}`}
                  onClick={() => pickTool(t)}
                >
                  {t.name}<i>{rest === Infinity ? '∞' : `${rest}${t.unit}`}</i>
                </button>
              )
            })}
          </div>
        </div>
        {tool && !tool.unlimited && tool.pools.length > 1 && (
          <div className="field">
            <span className="field-label">扣哪部分额度</span>
            <div className="chips">
              {tool.pools.map((p, i) => (
                <button key={i} type="button"
                  className={`chip ${poolIdx === i ? 'on' : ''} ${poolRemaining(p) <= 0 ? 'dim' : ''}`}
                  onClick={() => setPoolIdx(i)}>
                  {p.label}<i>{poolRemaining(p)}{tool.unit}</i>
                </button>
              ))}
            </div>
          </div>
        )}
        {tool && !tool.unlimited && (
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
          <button className="primary" disabled={!valid} onClick={submit}>记录</button>
        </div>
      </div>
    </div>
  )
}
