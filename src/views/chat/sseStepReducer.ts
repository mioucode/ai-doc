/**
 * SSE 事件 → ChatMessage.steps 的归并器（reducer）
 *
 * 基于 docs/规则.md 实现。
 *
 * 规则：
 *   - content_block_start (tool_use) → 显示卡片，内容为 displayText
 *   - content_block_delta (text_delta) → 显示卡片，流式展示 text
 *   - content_block_stop → 显示卡片，展示 displayText / steps / normalizedResult.items
 *   - [DONE] → 流式输出结束
 */

import type {
  ContentBlockDeltaEvent,
  ContentBlockStartEvent,
  ContentBlockStopEvent,
  StreamEvent,
} from '@/api/chat/sse';

let stepIdCounter = 0;
const makeStepId = () => `sse-step-${++stepIdCounter}`;

/**
 * 创建归并器实例，绑定到一条 assistant 消息的 stepList。
 */
export const createSseStepReducer = (stepList: Step[]) => {
  let activeStepIndex: number | null = null;

  /** 根据 block 特征判断是否应该创建步骤 */
  function shouldCreateStep(block: ContentBlockStartEvent['content_block']): boolean {
    if (!block) return false;
    // thinking 类型不展示、不落步骤
    if (block.type === 'thinking') return false;
    return true;
  }

  function handleStart(event: ContentBlockStartEvent) {
    const block = event.content_block;
    if (!shouldCreateStep(block)) return;

    const displayText = block?.displayText || '';
    const step: Step = {
      id: makeStepId(),
      type: 'common',
      label: displayText,
      content: '',
      contentType: 'text',
      status: 'loading',
      streaming: true,
    };

    stepList.push(step);
    activeStepIndex = stepList.length - 1;
  }

  function handleDelta(event: ContentBlockDeltaEvent) {
    if (activeStepIndex === null) {
      console.warn('[Reducer] handleDelta: no active step');
      return;
    }

    const delta = event.delta;
    if (!delta) {
      console.warn('[Reducer] handleDelta: no delta');
      return;
    }

    const step = stepList[activeStepIndex];
    if (!step) {
      console.warn('[Reducer] handleDelta: no step at index', activeStepIndex);
      return;
    }

    // text_delta：流式追加文本
    if (delta.type === 'text_delta' && delta.text) {
      if (typeof step.content === 'string') {
        step.content += delta.text;
      } else {
        step.content = delta.text;
      }
      console.log('[Reducer] Delta applied:', delta.text.slice(0, 50), '-> content length:', step.content.length);
    }
  }

  function handleStop(event: ContentBlockStopEvent) {
    if (activeStepIndex === null) return;

    const step = stepList[activeStepIndex];
    if (!step) return;

    const payload = event.payload;
    console.log('[Reducer] handleStop event:', JSON.stringify(event, null, 2));

    if (!payload) {
      step.streaming = false;
      step.status = 'completed';
      activeStepIndex = null;
      return;
    }

    // 更新 label 为完成态文案
    if (payload.displayText) {
      step.label = payload.displayText;
    }

    // 更新对应任务的状态为 completed
    // 通过 stepTitle 或 skillName 匹配任务，因为 payload.stepIndex 是全局步骤序号而非规划步骤索引
    const completedSkillName = payload.skillName || payload.stepTitle || '';
    console.log('[Reducer] Attempting to match completed task, skillName:', completedSkillName);
    if (completedSkillName) {
      for (let i = 0; i < stepList.length; i++) {
        const s = stepList[i];
        console.log('[Reducer] Checking step', i, 'contentType:', s.contentType, 'has tasks:', !!s.content?.tasks);
        if (s.contentType === 'result' && s.content?.tasks) {
          console.log('[Reducer] Found result step with tasks:', s.content.tasks);
          const updatedTasks = s.content.tasks.map((t: any) => {
            const match = t.skillName === completedSkillName || t.title?.includes(completedSkillName);
            console.log('[Reducer] Comparing task:', t.skillName, 'vs', completedSkillName, 'match:', match);
            if (match) {
              return { ...t, status: 'completed' as const };
            }
            return t;
          });
          const hasChanges = updatedTasks.some((t: any, idx: number) => t.status !== s.content.tasks[idx].status);
          console.log('[Reducer] Task status changes:', hasChanges, 'updated tasks:', updatedTasks);
          if (hasChanges) {
            // 替换整个 step 对象以触发 Vue 响应式更新
            stepList[i] = {
              ...s,
              content: { ...s.content, tasks: updatedTasks },
            };
          }
          break;
        }
      }
    }

    // 处理 steps 列表（规划阶段产物）- 将任务列表整合到当前步骤卡片中
    const planSteps = payload.plan?.steps;
    if (planSteps && planSteps.length > 0) {
      console.log('[Reducer] Setting plan tasks on current step:', planSteps);
      // 替换整个 step 对象以触发 Vue 响应式更新
      // type 保持 'common' 以使用 CommonStep 组件显示标题栏
      // contentType 设为 'result' 让 CommonStep 内部渲染 ResultStep
      stepList[activeStepIndex!] = {
        ...step,
        type: 'common',
        content: {
          tasks: planSteps.map((s, idx) => ({
            id: `task-${s.index ?? idx + 1}`,
            title: s.displayTitle || s.title || '',
            skillName: s.skillName || '',
            status: 'pending' as const,
          })),
        },
        contentType: 'result',
        streaming: false,
        status: 'completed',
      };
      console.log('[Reducer] Step after update:', JSON.stringify(stepList[activeStepIndex!], null, 2));
    }
    // 处理检索结果列表 - 创建独立的内容卡片
    else if (payload.normalizedResult?.items && payload.normalizedResult.items.length > 0) {
      console.log('[Reducer] Setting searchResult content with items:', payload.normalizedResult.items);
      // 清空当前 common 步骤的 content，只显示标题栏
      step.content = '';
      const contentStep: Step = {
        id: makeStepId(),
        type: 'searchResult',
        label: '检索结果',
        content: {
          items: payload.normalizedResult.items.map((item) => ({
            title: item.title || '',
            description: item.description || '',
            url: item.url || '',
          })),
          total: payload.normalizedResult.itemsTotal,
        },
        contentType: 'searchResult',
        status: 'completed',
        streaming: false,
      };
      stepList.push(contentStep);
    }
    // 处理文档审核结果 - 当前步骤保留为标题，文档内容作为新步骤
    else if (payload.tool === 'doc_reviewer' && payload.normalizedResult?.resultList) {
      console.log('[Reducer] Setting docReviewer content with resultList:', payload.normalizedResult.resultList);
      // 当前步骤已完成，清空 content 只保留标题栏
      step.content = '';
      step.streaming = false;
      step.status = 'completed';
      step.icon = 'pen';
      // 创建文档审核内容步骤
      const contentStep: Step = {
        id: makeStepId(),
        type: 'docReviewer',
        label: '文档审核',
        content: {
          body: payload.normalizedResult.document || '',
          issues: payload.normalizedResult.resultList.map((item: any, idx: number) => ({
            id: `issue-${idx}`,
            title: item.errorType || '表述问题',
            description: item.reason || '',
            errorWord: item.errorWord || '',
            rightWord: item.rightWord || '',
            offsets: item.offsets,
            context: item.context || '',
          })),
        },
        contentType: 'docReviewer',
        status: 'completed',
        streaming: false,
      };
      stepList.push(contentStep);
      activeStepIndex = null;
      return;
    }
    // 处理写作最终文档 - 当前步骤保留为标题，文档内容作为新步骤
    else if (payload.normalizedResult?.document) {
      // 当前步骤已完成，清空 content 只保留标题栏
      step.content = '';
      step.streaming = false;
      step.status = 'completed';
      step.icon = 'pen';
      // 创建文档内容步骤
      const contentStep: Step = {
        id: makeStepId(),
        type: 'documentCard',
        label: '文档输出',
        content: { body: payload.normalizedResult.document },
        contentType: 'documentCard',
        status: 'completed',
        streaming: false,
      };
      stepList.push(contentStep);
      activeStepIndex = null;
      return;
    }
    // 处理主 Agent 直答文本
    else if (payload.normalizedResult?.text) {
      step.content = payload.normalizedResult.text;
      step.contentType = 'text';
    }

    step.streaming = false;
    step.status = 'completed';
    activeStepIndex = null;
  }

  return {
    apply(event: StreamEvent) {
      switch (event.type) {
        case 'content_block_start':
          handleStart(event as ContentBlockStartEvent);
          break;
        case 'content_block_delta':
          handleDelta(event as ContentBlockDeltaEvent);
          break;
        case 'content_block_stop':
          handleStop(event as ContentBlockStopEvent);
          break;
        case 'message_stop':
          // 流结束，清理残留状态
          activeStepIndex = null;
          break;
        default:
          break;
      }
    },
  };
};
