export type BillingType = 'free' | 'paid'

export type ResetRule =
  | { kind: 'daily'; hour: number; minute: number }
  | { kind: 'monthly'; day: number; hour: number; minute: number }
  | { kind: 'manual' }

/** 一个额度池：如「余额」（充值/一次性，不自动重置）或「每日免费」（每天刷新） */
export interface QuotaPool {
  label: string
  quota: number
  used: number
  reset: ResetRule
  /** 当前周期起点，ISO datetime */
  lastReset: string
}

export interface Tool {
  id: string
  name: string
  url?: string
  category: string
  billing: BillingType
  /** 额度单位：次 / % / tokens / 积分 / 元 … */
  unit: string
  /** 不限量：不追踪数值额度，只记任务（如订阅套餐、免费无限的产品） */
  unlimited: boolean
  /** 额度池，unlimited 时为空；最多两个（余额 + 每日免费） */
  pools: QuotaPool[]
  /** 订阅/套餐有效期，ISO 日期 yyyy-mm-dd，免费付费都可配 */
  validFrom?: string
  validTo?: string
  createdAt: string
}

export interface UsageLog {
  id: string
  toolId: string
  amount: number
  task?: string
  at: string
}

export interface AppData {
  version: 2
  tools: Tool[]
  logs: UsageLog[]
  categories: string[]
  /** 预置产品是否已注入过（防止删除后重新出现） */
  seeded?: boolean
}

export const DEFAULT_CATEGORIES = [
  '对话', '代码', '文生图', '文生视频', '音频', 'Agent', 'API', '办公/写作', '搜索', '设计', '其他',
]

export const DEFAULT_UNITS = ['次', '%', 'tokens', '积分', '元']

export const POOL_BALANCE = '余额'
export const POOL_DAILY_FREE = '每日免费'
export const POOL_DEFAULT = '额度'
