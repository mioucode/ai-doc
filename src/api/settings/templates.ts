import request from '@/utils/request'

type ApiEnvelope<T> = {
  code: number
  message: string
  data: T
}

// ==================== 类型定义 ====================

export interface Template {
  id: string
  title: string
  documentType: string
  filePath: string
  createdAt: string
  updatedAt: string
}

export interface CreateTemplatePayload {
  title: string
  document_type?: string
  file: File
}

// ==================== API 函数 ====================

/** 获取模板列表 */
export async function getTemplates(): Promise<Template[]> {
  const res = (await request.get('/settings/templates')) as ApiEnvelope<Template[]>
  return Array.isArray(res.data) ? res.data : []
}

/** 创建模板 */
export async function createTemplate(payload: CreateTemplatePayload): Promise<Template> {
  const formData = new FormData()
  formData.append('title', payload.title)
  if (payload.document_type) {
    formData.append('document_type', payload.document_type)
  }
  formData.append('file', payload.file)

  const res = (await request.post('/settings/templates', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })) as ApiEnvelope<Template>
  return res.data
}

/** 删除模板 */
export async function deleteTemplate(templateId: string): Promise<boolean> {
  await request.delete(`/settings/templates/${templateId}`)
  return true
}
