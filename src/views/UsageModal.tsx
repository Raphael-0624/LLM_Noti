import { useState } from 'react'
import type { Tool } from '../types'

export function UsageModal({ tool, onSubmit, onClose }: {
  tool: Tool
  onSubmit: (tool: Tool, amount: number, task: string) => void
  onClose: () => void
}) {
  const [amount, setAmount] = useState('1')
  const [task, setTask] = useState('')
  const n = Number(amount)
  const valid = Number.isFinite(n) && n > 0

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>记一笔 · {tool.name}</h3>
        <label>
          消耗量（{tool.unit}）
          <input autoFocus type="number" min="0" step="any" value={amount}
            onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label>
          任务描述（可选）
          <input type="text" placeholder="比如：给周报生成配图" value={task}
            onChange={(e) => setTask(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && valid) onSubmit(tool, n, task) }} />
        </label>
        <div className="modal-actions">
          <button onClick={onClose}>取消</button>
          <button className="primary" disabled={!valid} onClick={() => onSubmit(tool, n, task)}>记录</button>
        </div>
      </div>
    </div>
  )
}
