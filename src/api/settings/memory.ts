import request from '@/utils/request'

type ApiEnvelope<T> = {
  code: number
  message: string
  data: T
}

// ==================== 类型定义 ====================

export interface UserMemory {
  identity: Record<string, unknown>
  memory: Record<string, unknown>
  identifyMarkdown: string | null
  memoryMarkdown: string | null
}

// ==================== API 函数 ====================

/** 获取记忆 */
export async function getMemory(): Promise<UserMemory> {
  const res = (await request.get('/settings/memory')) as ApiEnvelope<UserMemory>
  return res.data
}

/** 更新记忆 */
export async function updateMemory(payload: Partial<UserMemory>): Promise<boolean> {
  await request.put('/settings/memory', payload)
  return true
}

/** 清除记忆 */
export async function clearMemory(): Promise<boolean> {
  await request.delete('/settings/memory')
  return true
}
