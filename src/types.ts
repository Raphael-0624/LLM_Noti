export type BillingType = 'free' | 'paid'

export type ResetRule =
  | { kind: 'daily'; hour: number; minute: number }
  | { kind: 'monthly'; day: number; hour: number; minute: number }
  | { kind: 'manual' }

export interface Tool {
  id: string
  name: string
  url?: string
  category: string
  billing: BillingType
  /** 额度单位：次 / tokens / 积分 / % / $ … */
  unit: string
  /** 免费：每周期额度；付费：有效期内总量 */
  quota: number
  /** 当前周期已用量（免费）或累计已用量（付费） */
  used: number
  reset: ResetRule
  /** 付费工具的有效期，ISO 日期 yyyy-mm-dd */
  validFrom?: string
  validTo?: string
  /** 当前周期起点，ISO datetime */
  lastReset: string
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
  version: 1
  tools: Tool[]
  logs: UsageLog[]
  categories: string[]
}

export const DEFAULT_CATEGORIES = [
  '对话', '代码', '文生图', '文生视频', '音频', 'Agent', 'API', '办公/写作', '搜索', '设计', '其他',
]

export const DEFAULT_UNITS = ['次', '%', 'tokens', '积分', '$']
