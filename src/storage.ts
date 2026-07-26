import type { AppData, Tool } from './types'
import { DEFAULT_CATEGORIES } from './types'

const KEY = 'llm-noti:data'

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const data = JSON.parse(raw) as AppData
      if (data.version === 1) return data
    }
  } catch {
    // 数据损坏时从空白开始，不覆盖旧数据以便手动救回
  }
  return { version: 1, tools: [], logs: [], categories: [...DEFAULT_CATEGORIES] }
}

export function saveData(data: AppData) {
  localStorage.setItem(KEY, JSON.stringify(data))
}

/** 计算工具在 now 之前最近一次「应重置时刻」；手动重置返回 null */
export function lastDueReset(tool: Tool, now: Date): Date | null {
  if (tool.reset.kind !== 'daily') return null
  const due = new Date(now)
  due.setHours(tool.reset.hour, tool.reset.minute, 0, 0)
  if (due > now) due.setDate(due.getDate() - 1)
  return due
}

/** 打开时结转：跨过重置时刻的免费工具，当前周期用量归零 */
export function rolloverTools(tools: Tool[], now = new Date()): { tools: Tool[]; changed: boolean } {
  let changed = false
  const next = tools.map((t) => {
    if (t.billing !== 'free') return t
    const due = lastDueReset(t, now)
    if (due && new Date(t.lastReset) < due) {
      changed = true
      return { ...t, used: 0, lastReset: due.toISOString() }
    }
    return t
  })
  return { tools: next, changed }
}

export function exportJson(data: AppData): string {
  return JSON.stringify(data, null, 2)
}

export function importJson(raw: string): AppData {
  const data = JSON.parse(raw) as AppData
  if (data.version !== 1 || !Array.isArray(data.tools) || !Array.isArray(data.logs)) {
    throw new Error('文件格式不正确')
  }
  return data
}
