/**
 * API 统一类型定义
 */

// ==================== 通用类型 ====================

/**
 * API 统一响应格式
 */
declare interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
}

// ==================== 会话模块 ====================

declare interface ConversationListItem {
  id: string
  title: string
  pinned: boolean
  updatedAt: string
  lastRunId?: string
  meta?: string
}

declare interface ConversationMessage {
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

declare interface ConversationDetail {
  id: string
  title: string
  pinned: boolean
  messages: ConversationMessage[]
}

declare interface RunPayload {
  content: string
  model?: string
  skill?: string | null
  attachments?: string[]
  resume_from_waiting?: boolean
  selected_option?: string | null
  prompt_menu_input?: string | null
}

declare interface RunResponse {
  conversationId: string
  conversationTitle: string
  runId: string
  taskId: string
  streamUrl: string
}

// ==================== 工作空间模块 ====================

declare interface WorkspaceNode {
  id: string
  name: string
  type: 'folder' | 'document' | 'file'
  parentId: string | null
  createdAt: string
  updatedAt: string
  meta?: Record<string, unknown>
}

declare interface WorkspaceTree {
  id: string
  name: string
  type: 'folder' | 'document' | 'file'
  children?: WorkspaceTree[]
  createdAt: string
  updatedAt: string
}

declare interface WorkspaceListItem {
  id: string
  name: string
  type: 'folder' | 'document' | 'file'
  openedAt?: string
  owner?: string
}

declare interface DocumentDetail {
  id: string
  name: string
  title: string
  contentHtml: string
  contentText: string
  annotations: unknown[]
  createdAt: string
  updatedAt: string
}

declare interface UploadResult {
  id: string
  name: string
  path: string
  size: number
  mimeType: string
  createdAt: string
}

// ==================== 设置模块 ====================

declare interface UserProfile {
  defaultModel: string | null
  preferredSkills: string[]
  recommendationSummary: string | null
}

declare interface UserMemory {
  identity: Record<string, unknown>
  memory: Record<string, unknown>
  identifyMarkdown: string | null
  memoryMarkdown: string | null
}

declare type DictionaryType = 'whiteList' | 'blackList' | 'custom'

declare interface DictionaryEntry {
  id: string
  dictType: DictionaryType
  word: string
  notes: string
  createdAt: string
  updatedAt: string
}

declare interface Template {
  id: string
  title: string
  documentType: string
  filePath: string
  createdAt: string
  updatedAt: string
}

// ==================== 核心模块 ====================

declare interface HealthStatus {
  status: 'ok' | 'error'
  version?: string
  timestamp?: string
}

declare interface CurrentUser {
  id: string
  name: string
  account: string
  orgName?: string
  orgCode?: string
}

declare interface ModelInfo {
  id: string
  label: string
  description?: string
  capabilities?: string[]
}

declare interface SkillInfo {
  key: string
  title: string
  summary: string
  example: string
  examples: string[]
}

// ==================== SSE 流式事件类型 ====================

/** 工具调用块：用于规划/检索等非纯文本阶段 */
declare interface ToolUseBlock {
  type: 'tool_use'
  skillName: 'a2a_planning' | 'retrieval' | 'general' | string
  displayText?: string
}

/** 纯文本块：写作阶段使用 */
declare interface TextBlock {
  type: 'text'
  purpose?: 'article_draft' | string
  skillName?: 'writing' | string
  displayText?: string
}

/** 思考块（简单回答场景，不展示不落步骤） */
declare interface ThinkingBlock {
  type: 'thinking'
  displayText?: string
}

declare type ContentBlock = ToolUseBlock | TextBlock | ThinkingBlock

/** 写作阶段每次推送的增量文本 */
declare interface TextDelta {
  type: 'text_delta'
  text: string
}

/** 思考流增量 */
declare interface ThinkingDelta {
  type: 'thinking_delta'
  thinking: string
}

/** 规划步骤 */
declare interface PlanStep {
  index: number
  skillName: string
  title: string
  displayTitle?: string
  dependsOn?: string[]
  subtaskRole?: string
}

/** content_block_stop 的 payload */
declare interface ToolStopPayload {
  tool: 'a2a_planning' | 'retrieval' | 'writing' | 'main_agent' | string
  skillName?: string
  stepIndex?: number
  stepTitle?: string
  displayText?: string
  retryable?: boolean
  sourceState?: 'legacy_success' | 'model_success' | string
  errorDetail?: unknown
  steps?: number
  plan?: {
    intent?: string
    summary?: string
    steps: PlanStep[]
  }
  normalizedResult?: {
    source?: string
    items?: Array<{ title?: string; description?: string; url?: string }>
    itemsTotal?: number
    document?: string
    text?: string
  }
}

/** 基础事件 */
declare interface StreamEventBase {
  type: string
  [key: string]: unknown
}

/** 流开始标志 */
declare interface MessageStartEvent extends StreamEventBase {
  type: 'message_start'
}

/** 内容块开始 */
declare interface ContentBlockStartEvent extends StreamEventBase {
  type: 'content_block_start'
  content_block?: ContentBlock
}

/** 内容块增量 */
declare interface ContentBlockDeltaEvent extends StreamEventBase {
  type: 'content_block_delta'
  delta?: TextDelta | ThinkingDelta | (Record<string, unknown> & { text?: string; thinking?: string })
}

/** 内容块结束 */
declare interface ContentBlockStopEvent extends StreamEventBase {
  type: 'content_block_stop'
  payload?: ToolStopPayload
}

/** 消息增量 */
declare interface MessageDeltaEvent extends StreamEventBase {
  type: 'message_delta'
  delta?: { stop_reason?: string }
}

/** 流结束标志 */
declare interface MessageStopEvent extends StreamEventBase {
  type: 'message_stop'
}

declare type StreamEvent =
  | MessageStartEvent
  | ContentBlockStartEvent
  | ContentBlockDeltaEvent
  | ContentBlockStopEvent
  | MessageDeltaEvent
  | MessageStopEvent
  | StreamEventBase
