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
      if (data.version === 1) {
        // 老数据合并进新的默认分类，同时保留用户自建分类
        const categories = [...new Set([...DEFAULT_CATEGORIES, ...data.categories])]
        return { ...data, categories }
      }
    }
  } catch {
    // 数据损坏时从空白开始，不覆盖旧数据以便手动救回
  }
  return { version: 1, tools: [], logs: [], categories: [...DEFAULT_CATEGORIES] }
}

export function saveData(data: AppData) {
  localStorage.setItem(KEY, JSON.stringify(data))
}

/** 每月规则里，某年某月的实际重置日（处理 29/30/31 不存在的月份） */
function clampDay(year: number, month: number, day: number): number {
  return Math.min(day, new Date(year, month + 1, 0).getDate())
}

/** 计算工具在 now 之前最近一次「应重置时刻」；仅手动重置返回 null */
export function lastDueReset(tool: Tool, now: Date): Date | null {
  const r = tool.reset
  if (r.kind === 'daily') {
    const due = new Date(now)
    due.setHours(r.hour, r.minute, 0, 0)
    if (due > now) due.setDate(due.getDate() - 1)
    return due
  }
  if (r.kind === 'monthly') {
    let y = now.getFullYear()
    let m = now.getMonth()
    let due = new Date(y, m, clampDay(y, m, r.day), r.hour, r.minute, 0, 0)
    if (due > now) {
      m -= 1
      if (m < 0) { m = 11; y -= 1 }
      due = new Date(y, m, clampDay(y, m, r.day), r.hour, r.minute, 0, 0)
    }
    return due
  }
  return null
}

/** 下一次自动重置时刻；仅手动重置返回 null */
export function nextResetAt(tool: Tool, now: Date): Date | null {
  const r = tool.reset
  const due = lastDueReset(tool, now)
  if (!due || r.kind === 'manual') return null
  if (r.kind === 'daily') {
    const next = new Date(due)
    next.setDate(next.getDate() + 1)
    return next
  }
  let y = due.getFullYear()
  let m = due.getMonth() + 1
  if (m > 11) { m = 0; y += 1 }
  return new Date(y, m, clampDay(y, m, r.day), r.hour, r.minute, 0, 0)
}

/** 本地时区的 yyyy-mm-dd，避免 UTC 日期在凌晨归错天 */
export function localDay(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
