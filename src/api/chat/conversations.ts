import request from '@/utils/request'

type ApiEnvelope<T> = {
  code: number
  message: string
  data: T
}

// ==================== 类型定义 ====================

export interface ConversationListItem {
  id: string
  title: string
  pinned: boolean
  updatedAt: string
  lastRunId?: string
  meta?: string
}

export interface ConversationMessage {
  id: string
  runId?: string
  role: 'user' | 'assistant' | 'system'
  skillName?: string
  content?: string | Record<string, unknown>
  contentHtml?: string
  model?: string
  annotations?: unknown[]
  meta?: Record<string, unknown>
  createdAt: string
}

export interface ConversationDetail {
  id: string
  title: string
  pinned: boolean
  messages: ConversationMessage[]
}

export interface RunPayload {
  content: string
  model?: string
  skill?: string | null
  attachments?: string[]
  resume_from_waiting?: boolean
  selected_option?: string | null
  prompt_menu_input?: string | null
}

export interface RunResponse {
  conversationId: string
  conversationTitle: string
  runId: string
  taskId: string
  streamUrl: string
}

export interface CreateConversationPayload {
  title: string
}

export interface CreateConversationResponse {
  id: string
  title: string
  createdAt: string
}

// ==================== API 函数 ====================

/** 获取会话列表 */
export async function listConversations(): Promise<ConversationListItem[]> {
  const res = (await request.get('/conversations')) as ApiEnvelope<ConversationListItem[]>
  return Array.isArray(res.data) ? res.data : []
}

/** 创建会话 */
export async function createConversation(
  payload: CreateConversationPayload
): Promise<CreateConversationResponse> {
  const res = (await request.post(
    '/conversations',
    payload
  )) as ApiEnvelope<CreateConversationResponse>
  return res.data
}

/** 获取会话详情 */
export async function getConversationDetail(
  conversationId: string
): Promise<ConversationDetail> {
  const res = (await request.get(
    `/conversations/${conversationId}`
  )) as ApiEnvelope<ConversationDetail>
  return res.data
}

/** 更新会话（重命名/置顶） */
export async function updateConversation(
  conversationId: string,
  payload: { title?: string; pinned?: boolean }
): Promise<boolean> {
  await request.put(`/conversations/${conversationId}`, payload)
  return true
}

/** 删除会话 */
export async function deleteConversation(conversationId: string): Promise<boolean> {
  await request.delete(`/conversations/${conversationId}`)
  return true
}

/** 运行会话（发送消息） */
export async function runConversation(
  conversationId: string,
  payload: RunPayload
): Promise<RunResponse> {
  const res = (await request.post(
    `/conversations/${conversationId}/run`,
    payload
  )) as ApiEnvelope<RunResponse>
  return res.data
}

/** 获取事件流 URL */
export function getEventStreamUrl(conversationId: string, runId: string): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/agentloop'
  return `${baseUrl}/conversations/${conversationId}/events?run_id=${runId}`
}
