import request from '@/utils/request'

type ApiEnvelope<T> = {
  code: number
  message: string
  data: T
}

// ==================== 类型定义 ====================

export interface UploadResult {
  id: string
  name: string
  path: string
  size: number
  mimeType: string
  createdAt: string
}

// ==================== API 函数 ====================

/** 上传文件到指定目录 */
export async function uploadFile(file: File, directory?: string): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('file', file)
  if (directory) {
    formData.append('directory', directory)
  }

  const res = (await request.post('/workspace/uploads', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })) as ApiEnvelope<UploadResult>
  return res.data
}

/** 批量上传文件 */
export async function uploadFiles(files: File[], directory?: string): Promise<UploadResult[]> {
  const results: UploadResult[] = []
  for (const file of files) {
    const result = await uploadFile(file, directory)
    results.push(result)
  }
  return results
}

/** 写入二进制文件 */
export async function writeBinaryFile(path: string, content: Blob): Promise<boolean> {
  await request.put('/workspace/files_binary', content, {
    params: { path },
    headers: {
      'Content-Type': 'application/octet-stream',
    },
  })
  return true
}
