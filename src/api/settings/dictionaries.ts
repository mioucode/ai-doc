import request from '@/utils/request'

type ApiEnvelope<T> = {
  code: number
  message: string
  data: T
}

// ==================== 类型定义 ====================

export type DictionaryType = 'whiteList' | 'blackList' | 'custom'

export interface DictionaryEntry {
  id: string
  dictType: DictionaryType
  word: string
  notes: string
  createdAt: string
  updatedAt: string
}

export interface CreateDictionaryEntryPayload {
  dict_type: DictionaryType
  word: string
  notes?: string
}

// ==================== API 函数 ====================

/** 获取词典列表 */
export async function getDictionaries(): Promise<DictionaryEntry[]> {
  const res = (await request.get('/settings/dictionaries')) as ApiEnvelope<DictionaryEntry[]>
  return Array.isArray(res.data) ? res.data : []
}

/** 创建词典条目 */
export async function createDictionaryEntry(
  payload: CreateDictionaryEntryPayload
): Promise<DictionaryEntry> {
  const res = (await request.put(
    '/settings/dictionaries',
    payload
  )) as ApiEnvelope<DictionaryEntry>
  return res.data
}

/** 删除词典条目 */
export async function deleteDictionaryEntry(entryId: string): Promise<boolean> {
  await request.delete(`/settings/dictionaries/${entryId}`)
  return true
}
