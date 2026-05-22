import request from '@/utils/request'

type ApiEnvelope<T> = {
  code: number
  message: string
  data: T
}

// ==================== 类型定义 ====================

export interface WorkspaceNode {
  id: string
  name: string
  type: 'folder' | 'document' | 'file'
  parentId: string | null
  createdAt: string
  updatedAt: string
  meta?: Record<string, unknown>
}

export interface WorkspaceTree {
  id: string
  name: string
  type: 'folder' | 'document' | 'file'
  children?: WorkspaceTree[]
  createdAt: string
  updatedAt: string
}

export interface WorkspaceListItem {
  id: string
  name: string
  type: 'folder' | 'document' | 'file'
  openedAt?: string
  owner?: string
}

// ==================== API 函数 ====================

/** 获取工作空间列表 */
export async function listWorkspace(view: 'recent' | 'all' = 'recent'): Promise<WorkspaceListItem[]> {
  const res = (await request.get('/workspace', {
    params: { view },
  })) as ApiEnvelope<WorkspaceListItem[]>
  return Array.isArray(res.data) ? res.data : []
}

/** 获取目录树 */
export async function getWorkspaceTree(): Promise<WorkspaceTree[]> {
  const res = (await request.get('/workspace/tree')) as ApiEnvelope<WorkspaceTree[]>
  return Array.isArray(res.data) ? res.data : []
}

/** 创建文件夹 */
export async function createFolder(payload: {
  folder_name: string
  parent_dir?: string | null
}): Promise<WorkspaceNode> {
  const res = (await request.post('/workspace/folders', payload)) as ApiEnvelope<WorkspaceNode>
  return res.data
}

/** 重命名节点 */
export async function renameNode(nodeId: string, name: string): Promise<boolean> {
  await request.put(`/workspace/nodes/${nodeId}`, { name })
  return true
}

/** 移动节点 */
export async function moveNode(nodeId: string, parentId: string | null): Promise<boolean> {
  await request.put(`/workspace/nodes/${nodeId}/move`, { parent_id: parentId })
  return true
}

/** 删除节点 */
export async function deleteNode(nodeId: string): Promise<boolean> {
  await request.delete(`/workspace/nodes/${nodeId}`)
  return true
}

/** 发送到会话 */
export async function sendToConversation(nodeId: string): Promise<boolean> {
  await request.post(`/workspace/nodes/${nodeId}/send-to-conversation`)
  return true
}

/** 获取下载 URL */
export function getDownloadUrl(nodeId: string): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/agentloop'
  return `${baseUrl}/workspace/download/${nodeId}`
}

/** 下载文件 */
export async function downloadFile(nodeId: string): Promise<Blob> {
  const res = await request.get(`/workspace/download/${nodeId}`, {
    responseType: 'blob',
  })
  return res as unknown as Blob
}
