import { useEffect, useMemo, useState } from 'react'
import { ClockCounterClockwise, House, Plus, Wrench } from '@phosphor-icons/react'
import type { AppData, Tool, UsageLog } from './types'
import { loadData, rolloverTools, saveData, uid } from './storage'
import { Dashboard } from './views/Dashboard'
import { History } from './views/History'
import { ToolManager } from './views/ToolManager'
import { QuickLogSheet } from './views/QuickLogSheet'

type Tab = 'home' | 'history' | 'tools'

const TABS = [
  { key: 'home' as Tab, label: '首页', Icon: House },
  { key: 'history' as Tab, label: '历史', Icon: ClockCounterClockwise },
  { key: 'tools' as Tab, label: '工具', Icon: Wrench },
]

export default function App() {
  const [data, setData] = useState<AppData>(() => {
    const d = loadData()
    const { tools, changed } = rolloverTools(d.tools)
    return changed ? { ...d, tools } : d
  })
  const [tab, setTab] = useState<Tab>('home')
  const [quickLog, setQuickLog] = useState<{ tool: Tool | null } | null>(null)

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
    setQuickLog(null)
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
        <nav className="tabs" aria-label="主导航">
          {TABS.map(({ key, label, Icon }) => (
            <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
              <Icon size={22} weight={tab === key ? 'fill' : 'regular'} aria-hidden />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </header>

      {tab === 'home' && (
        <Dashboard data={data} onPick={(t) => setQuickLog({ tool: t })} onGoConfig={() => setTab('tools')} />
      )}
      {tab === 'history' && <History logs={data.logs} toolById={toolById} />}
      {tab === 'tools' && <ToolManager data={data} setData={setData} onReset={resetTool} />}

      {tab !== 'tools' && data.tools.length > 0 && (
        <button className="fab" aria-label="记一笔" onClick={() => setQuickLog({ tool: null })}>
          <Plus size={26} weight="bold" aria-hidden />
        </button>
      )}

      {quickLog && (
        <QuickLogSheet
          tools={data.tools}
          initialTool={quickLog.tool}
          onSubmit={addUsage}
          onClose={() => setQuickLog(null)}
        />
      )}
    </div>
  )
}
