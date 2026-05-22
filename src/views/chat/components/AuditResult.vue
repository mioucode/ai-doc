<template>
  <div class="audit-result-panel">
    <header class="audit-header">
      <h2 class="audit-title">{{ docTitleDisplay }}</h2>
      <button type="button" class="audit-close-btn" title="关闭" @click="emit('close')">
        <el-icon><Close /></el-icon>
      </button>
    </header>

    <div class="audit-body">
      <aside class="audit-issue-list">
        <article v-for="item in issueList" :key="item.id" class="issue-card" :class="{ 'is-selected': selectedIssueId === item.id }" @click="highlightErrorInEditor(item)">
          <h4 class="issue-title">{{ item.title }}</h4>
          <p class="issue-desc">{{ item.description }}</p>
          <div class="issue-actions">
            <button type="button" class="issue-btn accept" @click.stop="applyCorrection(item)">✓</button>
            <button type="button" class="issue-btn reject" @click.stop="rejectCorrection(item)">×</button>
          </div>
        </article>
        <div v-if="issueList.length === 0" class="issue-empty">未识别到问题项</div>
      </aside>

      <div class="audit-editor-wrap">
        <TinymceDocEditor ref="editorRef" :preview-raw-body="bodyText" :preview-streaming="isStreaming" variant="audit" @streaming-complete="onStreamingComplete" @editor-ready="initAllHighlights" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import TinymceDocEditor from '@/components/rich-text/TinymceDocEditor.vue';
import { Close } from '@element-plus/icons-vue';
import { parse } from '@/utils/document-parser';
import { computed, inject, nextTick, ref } from 'vue';
import { LINKED_EDITOR_KEY } from '../linkedEditor';

const props = withDefaults(
  defineProps<{
    step: Step;
    animated?: boolean;
  }>(),
  { animated: true },
);

const emit = defineEmits<{
  'streaming-complete': [];
  close: [];
}>();

const editorRef = ref();
const selectedIssueId = ref<string | null>(null);
const handledIssueIds = ref<Set<string>>(new Set());
const linkedHost = inject(LINKED_EDITOR_KEY, null);

const content = computed(() => (props.step.content && typeof props.step.content === 'object' ? (props.step.content as Record<string, unknown>) : {}));

const bodyText = computed(() => String(content.value.body ?? ''));
const isStreaming = computed(() => props.step.streaming === true);

type IssueItem = {
  id: string;
  title: string;
  description: string;
  errorWord: string;
  rightWord: string;
  offsets: number;
  context: string;
  contextOffset: number;
};

const issueList = computed<IssueItem[]>(() => {
  const raw = (Array.isArray(content.value.issues) && content.value.issues) || (Array.isArray(content.value.problems) && content.value.problems) || [];
  return (raw as Array<Record<string, unknown>>)
    .map((item, idx) => ({
      id: `issue-${idx}-${item.offsets}-${item.contextOffset}`,
      title: String(item.title || item.type || `问题${idx + 1}`),
      description: String(item.description || item.suggestion || item.message || ''),
      errorWord: String(item.errorWord || ''),
      rightWord: String(item.rightWord || ''),
      offsets: Number(item.offsets || 0),
      context: String(item.context || ''),
      contextOffset: Number(item.contextOffset || 0),
    }))
    .filter((item) => !handledIssueIds.value.has(item.id));
});

const docTitleDisplay = computed(() => {
  const raw = props.step.label || '审核结果';
  return raw.replace(/\.docx\s*$/i, '');
});

// 初始化所有错误高亮
const initAllHighlights = () => {
  if (!editorRef.value || isStreaming.value) return;

  const errors = issueList.value.map((item) => ({
    position: item.offsets + item.contextOffset,
    word: item.errorWord,
  }));

  if (errors.length > 0) {
    editorRef.value.highlightAllErrors(errors);
  }
};

// 流式结束后重新初始化高亮
const onStreamingComplete = () => {
  emit('streaming-complete');
  nextTick(() => {
    initAllHighlights();
  });
};

// 高亮错误词在编辑器中的函数
const highlightErrorInEditor = async (item: IssueItem) => {
  selectedIssueId.value = item.id;
  await nextTick();

  if (!editorRef.value) {
    console.error('editorRef is null');
    return;
  }

  // 聚焦并高亮当前错误
  const position = item.offsets + item.contextOffset;
  editorRef.value.focusError(position, item.errorWord);
};

// 应用修正：用正确文字替换错误文字
const applyCorrection = async (item: IssueItem) => {
  await nextTick();

  if (!editorRef.value) {
    console.error('editorRef is null');
    return;
  }

  // 计算错误词在原文中的精确位置
  const position = item.offsets + item.contextOffset;

  // 先移除高亮标记
  editorRef.value.removeHighlight(position);

  // 替换文字
  editorRef.value.replaceWordAt(position, item.errorWord, item.rightWord);

  // 从列表中移除已处理的项目
  handledIssueIds.value.add(item.id);
  selectedIssueId.value = null;
};

// 拒绝修正：删除错误文字
const rejectCorrection = async (item: IssueItem) => {
  await nextTick();

  if (!editorRef.value) {
    console.error('editorRef is null');
    return;
  }

  // 计算错误词在原文中的精确位置
  const position = item.offsets + item.contextOffset;

  // 移除高亮标记和删除文字（deleteWordAt 内部已处理）
  editorRef.value.deleteWordAt(position, item.errorWord);

  // 从列表中移除已处理的项目
  handledIssueIds.value.add(item.id);
  selectedIssueId.value = null;
};

const openEditor = () => {
  if (!linkedHost) return;
  const parsedBody = parse(bodyText.value || '');
  const nextStep: Step = {
    ...props.step,
    content: {
      ...content.value,
      body: parsedBody,
    },
  };
  linkedHost.open(nextStep);
};
</script>

<style scoped lang="scss">
.audit-result-panel {
  height: 100%;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.06);
  display: flex;
  flex-direction: column;
  background: #ffffff;
  overflow: hidden;
}

.audit-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
  background: #ffffff;
}

.audit-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.4;
}

.audit-close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #8c8c8c;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.04);
    color: #262626;
  }

  .el-icon {
    font-size: 18px;
  }
}

.audit-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 0;
  overflow: hidden;
}

.audit-issue-list {
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  border-right: 1px solid #f0f0f0;
  background: #f8fafc;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }
}

.issue-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
  padding: 16px;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  cursor: pointer;

  &:hover {
    border-color: #cbd5e1;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  &.is-selected {
    border-color: #0b57d0;
    box-shadow: 0 0 0 2px rgba(11, 87, 208, 0.15);
    background: #f0f7ff;
  }
}

.issue-title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.5;
}

.issue-desc {
  margin: 0;
  font-size: 13px;
  color: #64748b;
  line-height: 1.6;
}

.issue-actions {
  margin-top: 12px;
  display: flex;
  gap: 8px;
}

.issue-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;

  &.accept {
    background: #dcfce7;
    color: #16a34a;

    &:hover {
      background: #bbf7d0;
    }
  }

  &.reject {
    background: #fee2e2;
    color: #dc2626;

    &:hover {
      background: #fecaca;
    }
  }
}

.issue-empty {
  border: 1px dashed #cbd5e1;
  border-radius: 10px;
  padding: 24px 20px;
  font-size: 13px;
  color: #94a3b8;
  text-align: center;
  background: #ffffff;
}

.audit-editor-wrap {
  min-width: 0;
  height: 100%;
  overflow: hidden;
  background: #ffffff;
}
</style>
