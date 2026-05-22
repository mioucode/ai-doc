import request from '@/utils/request'

type ApiEnvelope<T> = {
  code: number
  message: string
  data: T
}

// ==================== 类型定义 ====================

export interface DocumentDetail {
  id: string
  name: string
  title: string
  contentHtml: string
  contentText: string
  annotations: unknown[]
  createdAt: string
  updatedAt: string
}

export interface CreateDocumentPayload {
  file_name: string
  parent_dir?: string | null
  content_html?: string
  content_text?: string
  source?: 'manual' | 'ai_generated' | 'uploaded'
}

export interface SaveDocumentPayload {
  title?: string
  content_html?: string
  content_text?: string
  annotations?: unknown[]
}

// ==================== API 函数 ====================

/** 创建文档 */
export async function createDocument(payload: CreateDocumentPayload): Promise<DocumentDetail> {
  const res = (await request.post(
    '/workspace/documents',
    payload
  )) as ApiEnvelope<DocumentDetail>
  return res.data
}

/** 获取文档详情 */
export async function getDocument(nodeId: string): Promise<DocumentDetail> {
  const res = (await request.get(
    `/workspace/documents/${nodeId}`
  )) as ApiEnvelope<DocumentDetail>
  return res.data
}

/** 保存文档 */
export async function saveDocument(
  nodeId: string,
  payload: SaveDocumentPayload
): Promise<boolean> {
  await request.put(`/workspace/documents/${nodeId}`, payload)
  return true
}
