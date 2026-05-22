# 前端 API 对接修改方案

## 一、概述

本文档基于 `docs/api.json` 中的 QwenPaw AgentLoop API 规范，对现有前端代码进行适配改造，确保前后端接口对接一致。

### 1.1 核心变更点

| 变更项 | 现状 | 目标 |
|--------|------|------|
| 基础路径 | `/api/agentloop` | `/api/agentloop`（保持一致） |
| 请求头 | `X-Legacy-*` 系列 | 统一使用 `X-Agent-Id` |
| 会话路径 | `/conversations` | `/conversations`（一致） |
| 运行会话 | `/conversations/run`（新建）<br>`/conversations/:id/run`（续写） | 同左，但需确认参数 |
| 事件流 | 使用返回的 `streamUrl` | 使用 `/conversations/:id/events?run_id=:runId` |
| 工作空间 | 无 | 新增完整 Workspace API 模块 |
| 设置模块 | 无 | 新增 Settings API 模块 |

### 1.2 文件变更清单

```
src/
├── api/
│   ├── index.ts                    # 修改：导出新增模块
│   ├── chat/
│   │   ├── conversations.ts        # 修改：调整接口路径和参数
│   │   ├── resources.ts            # 保持
│   │   ├── sse.ts                  # 修改：适配新事件流 URL
│   │   └── index.ts                # 修改：导出新模块
│   ├── workspace/                  # 新增：工作空间模块
│   │   ├── index.ts
│   │   ├── nodes.ts
│   │   ├── documents.ts
│   │   └── uploads.ts
│   └── settings/                   # 新增：设置模块
│       ├── index.ts
│       ├── profile.ts
│       ├── memory.ts
│       ├── dictionaries.ts
│       └── templates.ts
├── utils/
│   └── request.ts                  # 修改：调整请求头逻辑
└── types/
    └── api.d.ts                    # 新增：API 类型定义
```

---

## 二、请求层改造

### 2.1 修改 `src/utils/request.ts`

**变更内容：**
1. 将 `X-Legacy-*` 系列请求头替换为 `X-Agent-Id`
2. 支持 `agentId` 配置化（从环境变量或配置文件读取）

```typescript
// src/utils/request.ts
import axios from 'axios'

// 默认 AgentId，可通过环境变量覆盖
const DEFAULT_AGENT_ID = import.meta.env.VITE_AGENT_ID || 'default'

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/agentloop',
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Agent-Id': DEFAULT_AGENT_ID,
  },
})

request.interceptors.request.use(
  (config) => {
    // 确保 X-Agent-Id 存在
    if (!config.headers['X-Agent-Id']) {
      config.headers['X-Agent-Id'] = DEFAULT_AGENT_ID
    }

    // Bearer Token（如启用 Web 认证）
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error) => Promise.reject(error)
)

request.interceptors.response.use(
  (response) => {
    const { data } = response
    // 统一响应格式：{ code, message, data }
    if (data.code === 0 || data.code === 200) {
      return data
    }
    return Promise.reject(new Error(data.message || '请求失败'))
  },
  (error) => {
    const message = error.response?.data?.message || error.message || '网络错误'
    return Promise.reject(new Error(message))
  }
)

export default request
```

### 2.2 环境变量配置

```env
# .env.development
VITE_API_BASE_URL=http://127.0.0.1:8088
VITE_AGENT_ID=default

# .env.production
VITE_API_BASE_URL=/api/agentloop
VITE_AGENT_ID=default
```

---

## 三、会话模块改造

### 3.1 修改 `src/api/chat/conversations.ts`

**主要变更：**

| 接口 | 原路径 | 新路径 | 变更说明 |
|------|--------|--------|----------|
| 列表 | `GET /conversations` | `GET /conversations` | 无变化 |
| 详情 | `GET /conversations/:id` | `GET /conversations/:id` | 无变化 |
| 更新 | `PATCH /conversations/:id` | `PUT /conversations/:id` | 方法改为 PUT |
| 新建 | 无独立接口 | `POST /conversations` | 新增 |
| 删除 | `DELETE /conversations/:id` | `DELETE /conversations/:id` | 无变化 |
| 运行（新建）| `POST /conversations/run` | 无 | 移除，改用新建+运行 |
| 运行（续写）| `POST /conversations/:id/run` | `POST /conversations/:id/run` | 无变化 |

```typescript
// src/api/chat/conversations.ts
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

/** 创建会话（新增） */
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

/** 更新会话（重命名/置顶）- 方法改为 PUT */
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

/** 获取事件流 URL（新增辅助函数） */
export function getEventStreamUrl(conversationId: string, runId: string): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/agentloop'
  return `${baseUrl}/conversations/${conversationId}/events?run_id=${runId}`
}
```

### 3.2 修改 `src/api/chat/sse.ts`

**变更内容：**
1. 支持新的事件流 URL 格式
2. 添加 `X-Agent-Id` 和 `Accept: text/event-stream` 请求头

```typescript
// src/api/chat/sse.ts（关键修改部分）

export interface SSEConnectionOptions {
  conversationId?: string
  runId?: string
}

/**
 * 建立 SSE 连接
 * @param streamUrl 完整的事件流 URL，或通过 options 自动构建
 * @param handlers 事件处理器
 * @param options 可选：conversationId + runId 自动构建 URL
 */
export function createSSEConnection(
  streamUrl: string,
  handlers: SSEHandlers,
  options?: SSEConnectionOptions
): { close: () => void } {
  const controller = new AbortController()

  // 如果传入了 conversationId 和 runId，构建新格式 URL
  let url = streamUrl
  if (options?.conversationId && options?.runId) {
    url = getEventStreamUrl(options.conversationId, options.runId)
  }

  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
  }

  // 添加 Agent-Id
  const agentId = import.meta.env.VITE_AGENT_ID || 'default'
  if (agentId) {
    headers['X-Agent-Id'] = agentId
  }

  void fetch(url, {
    credentials: 'include',
    signal: controller.signal,
    headers,
  })
    .then(async (response) => {
      // ... 其余逻辑保持不变
    })
    .catch((error: unknown) => {
      if ((error as { name?: string }).name === 'AbortError') return
      handlers.onError(error instanceof Error ? error : new Error('SSE 连接异常'))
    })

  return {
    close: () => controller.abort(),
  }
}
```

---

## 四、新增工作空间模块

### 4.1 创建 `src/api/workspace/index.ts`

```typescript
// src/api/workspace/index.ts
export * from './nodes'
export * from './documents'
export * from './uploads'
```

### 4.2 创建 `src/api/workspace/nodes.ts`

```typescript
// src/api/workspace/nodes.ts
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
  name: string
  parent_id?: string | null
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

/** 下载文件 */
export function getDownloadUrl(nodeId: string): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/agentloop'
  return `${baseUrl}/workspace/download/${nodeId}`
}

/** 下载文件（带认证） */
export async function downloadFile(nodeId: string): Promise<Blob> {
  const res = await request.get(`/workspace/download/${nodeId}`, {
    responseType: 'blob',
  })
  return res as unknown as Blob
}
```

### 4.3 创建 `src/api/workspace/documents.ts`

```typescript
// src/api/workspace/documents.ts
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
  name: string
  parent_id?: string | null
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
```

### 4.4 创建 `src/api/workspace/uploads.ts`

```typescript
// src/api/workspace/uploads.ts
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

/** 上传文件 */
export async function uploadFile(file: File): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('file', file)

  const res = (await request.post('/workspace/uploads', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })) as ApiEnvelope<UploadResult>
  return res.data
}

/** 批量上传文件 */
export async function uploadFiles(files: File[]): Promise<UploadResult[]> {
  const results: UploadResult[] = []
  for (const file of files) {
    const result = await uploadFile(file)
    results.push(result)
  }
  return results
}
```

---

## 五、新增设置模块

### 5.1 创建 `src/api/settings/index.ts`

```typescript
// src/api/settings/index.ts
export * from './profile'
export * from './memory'
export * from './dictionaries'
export * from './templates'
```

### 5.2 创建 `src/api/settings/profile.ts`

```typescript
// src/api/settings/profile.ts
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
```

### 5.3 创建 `src/api/settings/memory.ts`

```typescript
// src/api/settings/memory.ts
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
```

### 5.4 创建 `src/api/settings/dictionaries.ts`

```typescript
// src/api/settings/dictionaries.ts
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
```

### 5.5 创建 `src/api/settings/templates.ts`

```typescript
// src/api/settings/templates.ts
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
```

---

## 六、核心接口改造

### 6.1 新增 `src/api/core.ts`

```typescript
// src/api/core.ts
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

export interface ModelInfo {
  id: string
  label: string
  description?: string
  capabilities?: string[]
}

export interface SkillInfo {
  key: string
  title: string
  summary: string
  example: string
  examples: string[]
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

/** 获取可用模型列表 */
export async function listModels(): Promise<ModelInfo[]> {
  const res = (await request.get('/models')) as ApiEnvelope<ModelInfo[]>
  return Array.isArray(res.data) ? res.data : []
}

/** 获取技能列表 */
export async function listSkills(): Promise<SkillInfo[]> {
  const res = (await request.get('/skills')) as ApiEnvelope<SkillInfo[]>
  return Array.isArray(res.data) ? res.data : []
}
```

---

## 七、业务层适配

### 7.1 修改 `src/views/chat/index.vue`

**关键修改点：**

1. **会话创建流程调整**
   - 原来：直接调用 `runNewConversation`
   - 现在：先调用 `createConversation`，再调用 `runConversation`

2. **事件流 URL 处理**
   - 使用新的 `/conversations/:id/events?run_id=:runId` 格式

```typescript
// src/views/chat/index.vue 中的关键修改

import { createConversation, runConversation, getEventStreamUrl } from '@/api'
import { createSSEConnection } from '@/api/chat/sse'

// 修改 processAssistantResponse 函数
const processAssistantResponse = async (data: SendData) => {
  // ... 添加 assistant 消息逻辑 ...

  const payload = {
    content: data.text,
    model: data.model,
    skill: data.skill || data.claw || null,
    attachments: [],
    resume_from_waiting: false,
    selected_option: null,
    prompt_menu_input: null,
  }

  const connect = async () => {
    try {
      let conversationId = currentSessionId.value || activeRealSessionId.value

      // 如果没有 conversationId，先创建会话
      if (!conversationId) {
        const newConv = await createConversation({
          title: data.text.trim().slice(0, 20) || '新对话',
        })
        conversationId = newConv.id
        activeRealSessionId.value = conversationId

        // 添加到侧边栏
        sessionStore.addSession({
          id: conversationId,
          title: newConv.title,
          pinned: false,
          createdAt: newConv.createdAt,
          updatedAt: newConv.createdAt,
        })
      }

      // 运行会话
      const runRes = await runConversation(conversationId, payload)

      // 使用新的事件流 URL
      const streamUrl = getEventStreamUrl(conversationId, runRes.runId)

      // 建立 SSE 连接
      activeStream.value = createSSEConnection(streamUrl, {
        onEvent: (event) => { /* ... */ },
        onDone: () => { /* ... */ },
        onError: (error) => { /* ... */ },
      })

    } catch (error) {
      // 错误处理
    }
  }

  void connect()
}
```

### 7.2 修改 `src/views/workspace/CloudDisk.vue`

**关键修改点：**
1. 引入工作空间 API
2. 替换本地 mock 数据为真实 API 调用

```typescript
// src/views/workspace/CloudDisk.vue 关键修改

import {
  listWorkspace,
  createFolder,
  createDocument,
  deleteNode,
  renameNode,
  downloadFile,
  uploadFile,
} from '@/api/workspace'
import type { WorkspaceListItem } from '@/api/workspace'

// 移除 mock 数据，改用 API
const recentFiles = ref<WorkspaceListItem[]>([])
const myFiles = ref<WorkspaceListItem[]>([])
const aiFiles = ref<WorkspaceListItem[]>([])

// 加载工作空间数据
const loadWorkspaceData = async () => {
  try {
    const data = await listWorkspace('recent')
    recentFiles.value = data
  } catch (error) {
    console.error('加载工作空间失败:', error)
  }
}

onMounted(() => {
  loadWorkspaceData()
})

// 新建文件夹
const handleCreate = async (id: 'docx' | 'folder') => {
  isCreateDropdownOpen.value = false
  const isFolder = id === 'folder'
  const title = isFolder ? '新建文件夹' : '新建docx文档'
  const name = await openPrompt({ title, placeholder: title })
  if (!name) return

  try {
    if (isFolder) {
      await createFolder({ name, parent_id: null })
    } else {
      await createDocument({
        name,
        parent_id: null,
        source: 'manual',
      })
    }
    ElMessage.success(isFolder ? '已新建文件夹' : '已新建 docx 文档')
    loadWorkspaceData()
  } catch (error) {
    ElMessage.error('创建失败')
  }
}

// 上传文件
const handleUploadChange = async (file: UploadFile) => {
  if (file?.raw) {
    try {
      await uploadFile(file.raw)
      ElMessage.success(`已上传：${file.name}`)
      loadWorkspaceData()
    } catch (error) {
      ElMessage.error('上传失败')
    }
  }
}

// 下载文件
const handleDownload = async (item: WorkspaceListItem) => {
  try {
    const blob = await downloadFile(item.id)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = item.name
    a.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    ElMessage.error('下载失败')
  }
}

// 删除节点
const handleDelete = async (item: WorkspaceListItem) => {
  try {
    await ElMessageBox.confirm(`确定要删除「${item.name}」吗？`, '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await deleteNode(item.id)
    ElMessage.success('删除成功')
    loadWorkspaceData()
  } catch {
    // 用户取消
  }
}
```

---

## 八、Store 适配

### 8.1 修改 `src/stores/session.ts`

```typescript
// src/stores/session.ts 关键修改

import {
  listConversations,
  createConversation,
  updateConversation,
  deleteConversation as deleteConversationApi,
} from '@/api'

export const useSessionStore = defineStore('session', {
  state: () => ({
    sessions: [] as ChatSession[],
    loading: false,
    resetSignal: 0,
    scratchActiveSessionId: null as string | null,
  }),

  actions: {
    async loadHistory() {
      this.loading = true
      try {
        const remoteList = await listConversations()
        this.sessions = remoteList.map((item) => ({
          id: item.id,
          title: item.title,
          pinned: item.pinned,
          updatedAt: item.updatedAt,
          createdAt: item.updatedAt,
        }))
        // 移除本地缓存逻辑，完全依赖后端
      } catch (error) {
        console.error('加载会话列表失败:', error)
      } finally {
        this.loading = false
      }
    },

    async createSession(title: string): Promise<string> {
      const result = await createConversation({ title })
      const session: ChatSession = {
        id: result.id,
        title: result.title,
        pinned: false,
        createdAt: result.createdAt,
        updatedAt: result.createdAt,
      }
      this.sessions.unshift(session)
      return result.id
    },

    async renameSession(sessionId: string, title: string): Promise<void> {
      await updateConversation(sessionId, { title })
      const item = this.findSession(sessionId)
      if (item) item.title = title
    },

    async togglePin(sessionId: string): Promise<boolean> {
      const item = this.findSession(sessionId)
      if (!item) return false
      const next = !item.pinned
      await updateConversation(sessionId, { pinned: next })
      item.pinned = next
      this.sortSessions()
      return next
    },

    async removeSession(sessionId: string): Promise<void> {
      await deleteConversationApi(sessionId)
      const idx = this.sessions.findIndex((s) => s.id === sessionId)
      if (idx > -1) this.sessions.splice(idx, 1)
    },

    sortSessions() {
      this.sessions.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        return 0
      })
    },
  },
})
```

---

## 九、实施计划

### 9.1 阶段一：基础设施改造（1天）

| 任务 | 文件 | 说明 |
|------|------|------|
| 修改请求头 | `src/utils/request.ts` | 替换 `X-Legacy-*` 为 `X-Agent-Id` |
| 添加环境变量 | `.env.*` | 配置 `VITE_AGENT_ID` |
| 创建类型定义 | `src/types/api.d.ts` | 统一 API 类型 |

### 9.2 阶段二：会话模块适配（1天）

| 任务 | 文件 | 说明 |
|------|------|------|
| 调整会话 API | `src/api/chat/conversations.ts` | 修改更新方法、新增创建接口 |
| 适配事件流 | `src/api/chat/sse.ts` | 支持新的事件流 URL 格式 |
| 修改会话视图 | `src/views/chat/index.vue` | 调整会话创建流程 |
| 修改会话 Store | `src/stores/session.ts` | 适配新 API |

### 9.3 阶段三：工作空间模块开发（2天）

| 任务 | 文件 | 说明 |
|------|------|------|
| 创建 API 模块 | `src/api/workspace/*.ts` | 工作空间相关接口 |
| 修改云盘视图 | `src/views/workspace/CloudDisk.vue` | 替换 mock 为真实 API |
| 添加文件操作 | `CloudDisk.vue` | 上传、下载、删除等 |

### 9.4 阶段四：设置模块开发（1天）

| 任务 | 文件 | 说明 |
|------|------|------|
| 创建 API 模块 | `src/api/settings/*.ts` | 设置相关接口 |
| 创建设置页面 | `src/views/settings/` | 用户配置、记忆、词典、模板 |

### 9.5 阶段五：测试与优化（1天）

| 任务 | 说明 |
|------|------|
| 接口联调 | 与后端进行接口联调 |
| 错误处理 | 完善错误提示和异常处理 |
| 性能优化 | 请求缓存、防抖节流 |

---

## 十、注意事项

### 10.1 兼容性处理

1. **响应格式统一**：后端返回 `{ code, message, data }`，已在 request 拦截器中统一处理
2. **错误码映射**：`code === 0` 或 `code === 200` 视为成功
3. **分页参数**：部分接口可能需要分页，后续根据实际情况补充

### 10.2 安全性考虑

1. **Token 存储**：Bearer Token 存储在 localStorage，建议考虑 XSS 风险
2. **CORS 配置**：确保后端正确配置 CORS，允许 `X-Agent-Id` 请求头
3. **敏感信息**：避免在 URL 中传递敏感信息

### 10.3 性能优化建议

1. **请求缓存**：模型列表、技能列表等静态数据可缓存
2. **懒加载**：工作空间目录树按需加载
3. **防抖节流**：搜索、重命名等操作添加防抖

---

## 十一、附录

### 11.1 完整 API 映射表

| 模块 | 功能 | 方法 | 路径 | 状态 |
|------|------|------|------|------|
| Core | 健康检查 | GET | `/health` | 新增 |
| Core | 获取用户 | GET | `/me` | 新增 |
| Core | 模型列表 | GET | `/models` | 保持 |
| Core | 技能列表 | GET | `/skills` | 保持 |
| Conversation | 列表 | GET | `/conversations` | 保持 |
| Conversation | 创建 | POST | `/conversations` | 新增 |
| Conversation | 详情 | GET | `/conversations/:id` | 保持 |
| Conversation | 更新 | PUT | `/conversations/:id` | 修改方法 |
| Conversation | 删除 | DELETE | `/conversations/:id` | 保持 |
| Conversation | 运行 | POST | `/conversations/:id/run` | 保持 |
| Conversation | 事件流 | GET | `/conversations/:id/events` | 新增 |
| Workspace | 列表 | GET | `/workspace` | 新增 |
| Workspace | 目录树 | GET | `/workspace/tree` | 新增 |
| Workspace | 创建文件夹 | POST | `/workspace/folders` | 新增 |
| Workspace | 创建文档 | POST | `/workspace/documents` | 新增 |
| Workspace | 获取文档 | GET | `/workspace/documents/:id` | 新增 |
| Workspace | 保存文档 | PUT | `/workspace/documents/:id` | 新增 |
| Workspace | 重命名 | PUT | `/workspace/nodes/:id` | 新增 |
| Workspace | 移动 | PUT | `/workspace/nodes/:id/move` | 新增 |
| Workspace | 删除 | DELETE | `/workspace/nodes/:id` | 新增 |
| Workspace | 下载 | GET | `/workspace/download/:id` | 新增 |
| Workspace | 上传 | POST | `/workspace/uploads` | 新增 |
| Settings | 获取配置 | GET | `/settings/profile` | 新增 |
| Settings | 更新配置 | PUT | `/settings/profile` | 新增 |
| Settings | 获取记忆 | GET | `/settings/memory` | 新增 |
| Settings | 更新记忆 | PUT | `/settings/memory` | 新增 |
| Settings | 清除记忆 | DELETE | `/settings/memory` | 新增 |
| Settings | 词典列表 | GET | `/settings/dictionaries` | 新增 |
| Settings | 创建词条 | PUT | `/settings/dictionaries` | 新增 |
| Settings | 删除词条 | DELETE | `/settings/dictionaries/:id` | 新增 |
| Settings | 模板列表 | GET | `/settings/templates` | 新增 |
| Settings | 创建模板 | POST | `/settings/templates` | 新增 |
| Settings | 删除模板 | DELETE | `/settings/templates/:id` | 新增 |

### 11.2 环境变量参考

```env
# .env.development
VITE_API_BASE_URL=http://127.0.0.1:8088
VITE_AGENT_ID=default

# .env.staging
VITE_API_BASE_URL=https://staging.example.com/api/agentloop
VITE_AGENT_ID=default

# .env.production
VITE_API_BASE_URL=/api/agentloop
VITE_AGENT_ID=default
```

---

## 十二、实施完成记录

### 12.1 已完成文件清单

| 文件路径 | 操作 | 说明 |
|----------|------|------|
| `src/utils/request.ts` | 修改 | 添加 `X-Agent-Id` 请求头支持 |
| `src/api/index.ts` | 修改 | 导出 workspace、settings、core 模块 |
| `src/api/chat/conversations.ts` | 修改 | 新增 `createConversation`、`getEventStreamUrl`，更新方法改为 PUT |
| `src/api/chat/sse.ts` | 修改 | 添加 `X-Agent-Id` 和 `Accept: text/event-stream` 请求头 |
| `src/api/workspace/index.ts` | 新增 | 工作空间模块入口 |
| `src/api/workspace/nodes.ts` | 新增 | 节点操作 API |
| `src/api/workspace/documents.ts` | 新增 | 文档操作 API |
| `src/api/workspace/uploads.ts` | 新增 | 文件上传 API |
| `src/api/settings/index.ts` | 新增 | 设置模块入口 |
| `src/api/settings/profile.ts` | 新增 | 用户配置 API |
| `src/api/settings/memory.ts` | 新增 | 记忆管理 API |
| `src/api/settings/dictionaries.ts` | 新增 | 词典管理 API |
| `src/api/settings/templates.ts` | 新增 | 模板管理 API |
| `src/api/core.ts` | 新增 | 核心接口（健康检查、用户信息） |
| `src/types/api.d.ts` | 新增 | API 类型定义 |
| `src/views/chat/index.vue` | 修改 | 调整会话创建流程，使用新事件流 URL |
| `src/views/workspace/CloudDisk.vue` | 修改 | 替换 mock 数据为真实 API |
| `src/stores/session.ts` | 修改 | 适配新 API，添加 `createSession` 方法 |
| `.env.example` | 修改 | 添加 `VITE_AGENT_ID` 配置说明 |
| `.env.development` | 新增 | 开发环境配置 |
| `.env.production` | 新增 | 生产环境配置 |

### 12.2 完成时间

- **阶段一**：基础设施改造 - 已完成
- **阶段二**：会话模块适配 - 已完成
- **阶段三**：工作空间模块开发 - 已完成
- **阶段四**：设置模块开发 - 已完成
- **阶段五**：验证与修复 - 进行中

### 12.3 待联调事项

1. 与后端确认 API 响应格式
2. 验证事件流 URL 格式是否正确
3. 测试工作空间文件上传/下载功能
4. 测试设置模块各项功能
