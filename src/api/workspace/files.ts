import request from '@/utils/request'

type ApiEnvelope<T> = {
  code: number
  message: string
  data: T
}

// ==================== 类型定义 ====================

export interface WorkspaceFileItem {
  id: string
  name: string
  type: 'file' | 'folder'
  path: string
  size?: number
  modifiedAt?: string
  createdAt?: string
}

export interface FileListParams {
  filename?: string
  sortOrder?: 'asc' | 'desc'
  path?: string
  page?: number
  pageSize?: number
}

export interface FileDetail {
  id: string
  name: string
  path: string
  type: 'file' | 'folder'
  size: number
  mimeType: string
  createdAt: string
  modifiedAt: string
  content?: string
}

export interface FileRenamePayload {
  path: string
  newFilename: string
}

export interface FileDeletePayload {
  paths: string[]
}

export interface BatchDownloadPayload {
  path: string[]
}

// ==================== API 函数 ====================

/** 工作区分页查看文件列表 */
export async function getWorkspaceFileList(params: FileListParams): Promise<WorkspaceFileItem[]> {
  const res = (await request.get('/workspace/get_list', {
    params,
  })) as ApiEnvelope<WorkspaceFileItem[]>
  return Array.isArray(res.data) ? res.data : []
}

/** 工作区查看文件详情 */
export async function getFileDetail(path: string): Promise<FileDetail> {
  const res = (await request.get('/workspace/file_detail', {
    params: { path },
  })) as ApiEnvelope<FileDetail>
  return res.data
}

/** 工作区文件重命名 */
export async function renameFile(payload: FileRenamePayload): Promise<boolean> {
  await request.put('/workspace/file_rename', payload)
  return true
}

/** 工作区文件删除 */
export async function deleteFiles(payload: FileDeletePayload): Promise<boolean> {
  await request.delete('/workspace/file_delete', {
    data: payload,
  })
  return true
}

/** 工作区批量下载文件 */
export async function batchDownload(payload: BatchDownloadPayload): Promise<Blob> {
  const res = await request.post('/workspace/download', payload, {
    responseType: 'blob',
  })
  return res as unknown as Blob
}
