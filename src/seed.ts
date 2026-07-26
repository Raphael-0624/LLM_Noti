import type { QuotaPool, ResetRule, Tool } from './types'
import { POOL_BALANCE, POOL_DAILY_FREE, POOL_DEFAULT } from './types'
import { uid } from './storage'

const DAILY_0: ResetRule = { kind: 'daily', hour: 0, minute: 0 }
const MANUAL: ResetRule = { kind: 'manual' }

function pool(label: string, quota: number, reset: ResetRule): QuotaPool {
  return { label, quota, used: 0, reset, lastReset: new Date().toISOString() }
}

type SeedSpec = Omit<Tool, 'id' | 'createdAt'>

/** 我自己在用的产品预置清单 */
const SEEDS: SeedSpec[] = [
  {
    name: 'ChatGPT 免费版', url: 'https://chatgpt.com', category: '对话',
    billing: 'free', unit: '次', unlimited: true, pools: [],
  },
  {
    name: 'Claude-公司', url: 'https://claude.ai', category: '对话',
    billing: 'paid', unit: '次', unlimited: true, pools: [], // Max 套餐
  },
  {
    name: 'Claude-自己', url: 'https://claude.ai', category: '对话',
    billing: 'paid', unit: '次', unlimited: true, pools: [], // Max 套餐
  },
  {
    // 免费版：一次性 1000 积分 + 每日刷新 300 积分
    name: 'Manus', url: 'https://manus.im', category: 'Agent',
    billing: 'free', unit: '积分', unlimited: false,
    pools: [pool(POOL_BALANCE, 1000, MANUAL), pool(POOL_DAILY_FREE, 300, DAILY_0)],
  },
  {
    name: 'DeepSeek', url: 'https://chat.deepseek.com', category: '对话',
    billing: 'free', unit: '次', unlimited: true, pools: [],
  },
  {
    name: 'DeepSeek API', url: 'https://platform.deepseek.com', category: 'API',
    billing: 'paid', unit: '元', unlimited: false,
    pools: [pool(POOL_BALANCE, 26, MANUAL)],
  },
  {
    name: '火山云 Coding Plan', url: 'https://www.volcengine.com', category: '代码',
    billing: 'paid', unit: '次', unlimited: true, pools: [],
    validFrom: '2026-06-09', validTo: '2026-08-09',
  },
  {
    name: 'DeepSider', category: '文生图',
    billing: 'free', unit: '次', unlimited: false,
    pools: [pool(POOL_DEFAULT, 2, DAILY_0)],
  },
  {
    name: 'Allyhub', category: '对话',
    billing: 'free', unit: '积分', unlimited: false,
    pools: [pool(POOL_BALANCE, 10000, MANUAL), pool(POOL_DAILY_FREE, 1000, DAILY_0)],
  },
  {
    name: 'Lovart', url: 'https://www.lovart.ai', category: '设计',
    billing: 'free', unit: '积分', unlimited: false,
    pools: [pool(POOL_BALANCE, 900, MANUAL), pool(POOL_DAILY_FREE, 70, DAILY_0)],
  },
  {
    // 每日登录发放当日免费积分，约 60-100 按活跃度浮动，先按 60 记
    name: '即梦', url: 'https://jimeng.jianying.com', category: '文生图',
    billing: 'free', unit: '积分', unlimited: false,
    pools: [pool(POOL_DAILY_FREE, 60, DAILY_0)],
  },
]

/** 注入预置产品，跳过同名已存在的 */
export function mergeSeeds(existing: Tool[]): Tool[] {
  const names = new Set(existing.map((t) => t.name))
  const added = SEEDS.filter((s) => !names.has(s.name)).map((s) => ({
    ...s,
    id: uid(),
    createdAt: new Date().toISOString(),
  }))
  return [...existing, ...added]
}
