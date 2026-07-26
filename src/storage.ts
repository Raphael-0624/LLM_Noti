import type { AppData, QuotaPool, ResetRule, Tool } from './types'
import { DEFAULT_CATEGORIES, POOL_DEFAULT } from './types'
import { mergeSeeds } from './seed'

const KEY = 'llm-noti:data'

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

/** v1 的工具结构：单额度直接挂在工具上 */
interface ToolV1 {
  id: string
  name: string
  url?: string
  category: string
  billing: 'free' | 'paid'
  unit: string
  quota: number
  used: number
  reset: ResetRule
  validFrom?: string
  validTo?: string
  lastReset: string
  createdAt: string
}

function migrateV1Tool(t: ToolV1): Tool {
  const pool: QuotaPool = {
    label: POOL_DEFAULT, quota: t.quota, used: t.used, reset: t.reset, lastReset: t.lastReset,
  }
  return {
    id: t.id, name: t.name, url: t.url, category: t.category, billing: t.billing,
    unit: t.unit, unlimited: false, pools: [pool],
    validFrom: t.validFrom, validTo: t.validTo, createdAt: t.createdAt,
  }
}

function normalize(data: AppData): AppData {
  // 老数据合并进新的默认分类，同时保留用户自建分类
  const categories = [...new Set([...DEFAULT_CATEGORIES, ...data.categories])]
  let tools = data.tools
  let seeded = data.seeded
  if (!seeded) {
    tools = mergeSeeds(tools)
    seeded = true
  }
  return { ...data, categories, tools, seeded }
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.version === 2) return normalize(parsed as AppData)
      if (parsed.version === 1) {
        return normalize({
          version: 2,
          tools: (parsed.tools as ToolV1[]).map(migrateV1Tool),
          logs: parsed.logs,
          categories: parsed.categories ?? [],
        })
      }
    }
  } catch {
    // 数据损坏时从空白开始，不覆盖旧数据以便手动救回
  }
  return normalize({ version: 2, tools: [], logs: [], categories: [...DEFAULT_CATEGORIES] })
}

export function saveData(data: AppData) {
  localStorage.setItem(KEY, JSON.stringify(data))
}

/** 每月规则里，某年某月的实际重置日（处理 29/30/31 不存在的月份） */
function clampDay(year: number, month: number, day: number): number {
  return Math.min(day, new Date(year, month + 1, 0).getDate())
}

/** 计算某条规则在 now 之前最近一次「应重置时刻」；仅手动重置返回 null */
export function lastDueReset(rule: ResetRule, now: Date): Date | null {
  if (rule.kind === 'daily') {
    const due = new Date(now)
    due.setHours(rule.hour, rule.minute, 0, 0)
    if (due > now) due.setDate(due.getDate() - 1)
    return due
  }
  if (rule.kind === 'monthly') {
    let y = now.getFullYear()
    let m = now.getMonth()
    let due = new Date(y, m, clampDay(y, m, rule.day), rule.hour, rule.minute, 0, 0)
    if (due > now) {
      m -= 1
      if (m < 0) { m = 11; y -= 1 }
      due = new Date(y, m, clampDay(y, m, rule.day), rule.hour, rule.minute, 0, 0)
    }
    return due
  }
  return null
}

/** 下一次自动重置时刻；仅手动重置返回 null */
export function nextResetAt(rule: ResetRule, now: Date): Date | null {
  const due = lastDueReset(rule, now)
  if (!due || rule.kind === 'manual') return null
  if (rule.kind === 'daily') {
    const next = new Date(due)
    next.setDate(next.getDate() + 1)
    return next
  }
  let y = due.getFullYear()
  let m = due.getMonth() + 1
  if (m > 11) { m = 0; y += 1 }
  return new Date(y, m, clampDay(y, m, rule.day), rule.hour, rule.minute, 0, 0)
}

/** 打开时结转：每个额度池独立检查，跨过重置时刻则当前周期用量归零 */
export function rolloverTools(tools: Tool[], now = new Date()): { tools: Tool[]; changed: boolean } {
  let changed = false
  const next = tools.map((t) => {
    if (t.pools.length === 0) return t
    let poolChanged = false
    const pools = t.pools.map((p) => {
      const due = lastDueReset(p.reset, now)
      if (due && new Date(p.lastReset) < due) {
        poolChanged = true
        return { ...p, used: 0, lastReset: due.toISOString() }
      }
      return p
    })
    if (!poolChanged) return t
    changed = true
    return { ...t, pools }
  })
  return { tools: next, changed }
}

export function poolRemaining(p: QuotaPool): number {
  return Math.max(0, p.quota - p.used)
}

/** 剩余总量；不限量返回 Infinity */
export function toolRemaining(t: Tool): number {
  if (t.unlimited) return Infinity
  return t.pools.reduce((sum, p) => sum + poolRemaining(p), 0)
}

/** 本地时区的 yyyy-mm-dd，避免 UTC 日期在凌晨归错天 */
export function localDay(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function exportJson(data: AppData): string {
  return JSON.stringify(data, null, 2)
}

export function importJson(raw: string): AppData {
  const parsed = JSON.parse(raw)
  if ((parsed.version !== 1 && parsed.version !== 2) || !Array.isArray(parsed.tools) || !Array.isArray(parsed.logs)) {
    throw new Error('文件格式不正确')
  }
  if (parsed.version === 1) {
    return {
      version: 2,
      tools: (parsed.tools as ToolV1[]).map(migrateV1Tool),
      logs: parsed.logs,
      categories: parsed.categories ?? [...DEFAULT_CATEGORIES],
      seeded: true,
    }
  }
  return parsed as AppData
}
