import { useEffect, useMemo, useState } from 'react'
import type { AppData, Tool, UsageLog } from './types'
import { loadData, rolloverTools, saveData, uid } from './storage'
import { Dashboard } from './views/Dashboard'
import { History } from './views/History'
import { ToolManager } from './views/ToolManager'
import { UsageModal } from './views/UsageModal'

type Tab = 'dashboard' | 'history' | 'tools'

export default function App() {
  const [data, setData] = useState<AppData>(() => {
    const d = loadData()
    const { tools, changed } = rolloverTools(d.tools)
    return changed ? { ...d, tools } : d
  })
  const [tab, setTab] = useState<Tab>('dashboard')
  const [usageFor, setUsageFor] = useState<Tool | null>(null)

  useEffect(() => saveData(data), [data])

  // 页面一直开着的情况下，每分钟检查一次是否跨过重置时刻
  useEffect(() => {
    const timer = setInterval(() => {
      setData((d) => {
        const { tools, changed } = rolloverTools(d.tools)
        return changed ? { ...d, tools } : d
      })
    }, 60_000)
    return () => clearInterval(timer)
  }, [])

  const toolById = useMemo(() => new Map(data.tools.map((t) => [t.id, t])), [data.tools])

  function addUsage(tool: Tool, amount: number, task: string) {
    const log: UsageLog = { id: uid(), toolId: tool.id, amount, task: task || undefined, at: new Date().toISOString() }
    setData((d) => ({
      ...d,
      logs: [log, ...d.logs],
      tools: d.tools.map((t) => (t.id === tool.id ? { ...t, used: t.used + amount } : t)),
    }))
    setUsageFor(null)
  }

  function resetTool(tool: Tool) {
    setData((d) => ({
      ...d,
      tools: d.tools.map((t) => (t.id === tool.id ? { ...t, used: 0, lastReset: new Date().toISOString() } : t)),
    }))
  }

  return (
    <div className="app">
      <header>
        <h1>LLM Noti</h1>
        <nav>
          <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>今日看板</button>
          <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>历史</button>
          <button className={tab === 'tools' ? 'active' : ''} onClick={() => setTab('tools')}>工具管理</button>
        </nav>
      </header>

      {tab === 'dashboard' && (
        <Dashboard data={data} onLog={setUsageFor} onReset={resetTool} onGoConfig={() => setTab('tools')} />
      )}
      {tab === 'history' && <History logs={data.logs} toolById={toolById} />}
      {tab === 'tools' && <ToolManager data={data} setData={setData} />}

      {usageFor && <UsageModal tool={usageFor} onSubmit={addUsage} onClose={() => setUsageFor(null)} />}
    </div>
  )
}
