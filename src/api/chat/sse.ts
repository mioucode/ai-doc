/**
 * SSE 事件协议（流式处理模块）
 *
 * 基于 docs/流式接口返回格式分析.md 实现
 */

// ==================== 内容块类型 ====================

/** 工具调用块：用于规划/检索等非纯文本阶段 */
export interface ToolUseBlock {
  type: 'tool_use'
  skillName: 'a2a_planning' | 'retrieval' | 'general' | string
  displayText?: string
}

/** 纯文本块：写作阶段使用 */
export interface TextBlock {
  type: 'text'
  purpose?: 'article_draft' | string
  skillName?: 'writing' | string
  displayText?: string
}

/** 思考块（简单回答场景，不展示不落步骤） */
export interface ThinkingBlock {
  type: 'thinking'
  displayText?: string
}

export type ContentBlock = ToolUseBlock | TextBlock | ThinkingBlock

/** 写作阶段每次推送的增量文本 */
export interface TextDelta {
  type: 'text_delta'
  text: string
}

/** 思考流增量 */
export interface ThinkingDelta {
  type: 'thinking_delta'
  thinking: string
}

/** 规划步骤 */
export interface PlanStep {
  index: number
  skillName: string
  title: string
  displayTitle?: string
  dependsOn?: string[]
  subtaskRole?: string
}

/** content_block_stop 的 payload */
export interface ToolStopPayload {
  tool: 'a2a_planning' | 'retrieval' | 'writing' | 'main_agent' | string
  skillName?: string
  stepIndex?: number
  stepTitle?: string
  displayText?: string
  retryable?: boolean
  sourceState?: 'legacy_success' | 'model_success' | string
  errorDetail?: unknown
  steps?: PlanStep[]
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
    resultList?: any[]
  }
}

// ==================== 事件类型 ====================

/** 基础事件 */
export interface StreamEventBase {
  type: string
  [key: string]: unknown
}

/** 流开始标志 */
export interface MessageStartEvent extends StreamEventBase {
  type: 'message_start'
}

/** 内容块开始 */
export interface ContentBlockStartEvent extends StreamEventBase {
  type: 'content_block_start'
  content_block?: ContentBlock
}

/** 内容块增量 */
export interface ContentBlockDeltaEvent extends StreamEventBase {
  type: 'content_block_delta'
  delta?: TextDelta | ThinkingDelta | (Record<string, unknown> & { text?: string; thinking?: string })
}

/** 内容块结束 */
export interface ContentBlockStopEvent extends StreamEventBase {
  type: 'content_block_stop'
  payload?: ToolStopPayload
}

/** 消息增量 */
export interface MessageDeltaEvent extends StreamEventBase {
  type: 'message_delta'
  delta?: { stop_reason?: string }
}

/** 流结束标志 */
export interface MessageStopEvent extends StreamEventBase {
  type: 'message_stop'
}

export type StreamEvent =
  | MessageStartEvent
  | ContentBlockStartEvent
  | ContentBlockDeltaEvent
  | ContentBlockStopEvent
  | MessageDeltaEvent
  | MessageStopEvent
  | StreamEventBase

export interface SSEHandlers {
  onEvent: (event: StreamEvent) => void
  onDone: () => void
  onError: (error: Error) => void
}

// ==================== SSE 连接 ====================

/** SSE 连接选项 */
export interface SSEConnectionOptions {
  conversationId?: string
  runId?: string
}

/** 默认 AgentId */
const DEFAULT_AGENT_ID = import.meta.env.VITE_AGENT_ID || 'default'

/**
 * 建立一条 SSE 长连接。
 *
 * 解析约定：
 *   - 每条事件以两个换行 `\n\n` 分隔（标准 EventStream 行为）
 *   - 每行以 `data:` 开头，data 内容直接 JSON.parse
 *   - `data: [DONE]` 是流终止哨兵，非 JSON，必须显式跳过
 *
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
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/agentloop'
    url = `${baseUrl}/conversations/${options.conversationId}/events?run_id=${options.runId}`
  }

  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
    'X-Agent-Id': DEFAULT_AGENT_ID,
  }

  const splitBuffer = (buffer: string) => {
    const blocks = buffer.split('\n\n')
    return {
      rest: blocks.pop() || '',
      blocks,
    }
  }

  void fetch(url, {
    credentials: 'include',
    signal: controller.signal,
    headers,
  })
    .then(async (response) => {
      if (!response.ok || !response.body) {
        throw new Error(`SSE 连接失败: ${response.status}`)
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) {
          handlers.onDone()
          break
        }
        buffer += decoder.decode(value, { stream: true })
        const parsed = splitBuffer(buffer)
        buffer = parsed.rest

        for (const block of parsed.blocks) {
          const lines = block.split('\n')
          const dataLines = lines
            .map((line) => line.trim())
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim())
          if (!dataLines.length) continue
          const dataText = dataLines.join('\n')

          if (dataText === '[DONE]') continue

          try {
            const event = JSON.parse(dataText) as StreamEvent
            console.log('[SSE] Received event:', event.type, event)
            handlers.onEvent(event)
          } catch (e) {
            // 非JSON片段（半截chunk），忽略
            console.warn('[SSE] Failed to parse event:', dataText.slice(0, 100))
          }
        }
      }
    })
    .catch((error: unknown) => {
      if ((error as { name?: string }).name === 'AbortError') return
      handlers.onError(error instanceof Error ? error : new Error('SSE 连接异常'))
    })

  return {
    close: () => controller.abort(),
  }
}
