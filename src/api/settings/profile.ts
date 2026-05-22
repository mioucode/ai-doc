import request from '@/utils/request'

type ApiEnvelope<T> = {
  code: number
  message: string
  data: T
}

// ==================== 类型定义 ====================

export interface UserProfile {
  defaultModel: string | null
  preferredSkills: string[]
  recommendationSummary: string | null
}

// ==================== API 函数 ====================

/** 获取用户配置 */
export async function getProfile(): Promise<UserProfile> {
  const res = (await request.get('/settings/profile')) as ApiEnvelope<UserProfile>
  return res.data
}

/** 更新用户配置 */
export async function updateProfile(payload: Partial<UserProfile>): Promise<boolean> {
  await request.put('/settings/profile', payload)
  return true
}
