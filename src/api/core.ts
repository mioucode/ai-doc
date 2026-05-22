import request from '@/utils/request'

type ApiEnvelope<T> = {
  code: number
  message: string
  data: T
}

// ==================== 类型定义 ====================

export interface HealthStatus {
  status: 'ok' | 'error'
  version?: string
  timestamp?: string
}

export interface CurrentUser {
  id: string
  name: string
  account: string
  orgName?: string
  orgCode?: string
}

// ==================== API 函数 ====================

/** 健康检查 */
export async function checkHealth(): Promise<HealthStatus> {
  const res = (await request.get('/health')) as ApiEnvelope<HealthStatus>
  return res.data
}

/** 获取当前用户信息 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const res = (await request.get('/me')) as ApiEnvelope<CurrentUser>
  return res.data
}
