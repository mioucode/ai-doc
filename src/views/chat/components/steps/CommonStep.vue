<template>
  <div class="common-step">
    <div class="step-header">
      <div class="step-icon" :class="`icon-${iconType}`">
        <el-icon v-if="iconType === 'search'"><Search /></el-icon>
        <el-icon v-else-if="iconType === 'pen'"><EditPen /></el-icon>
        <el-icon v-else><MagicStick /></el-icon>
      </div>
      <span class="step-label">{{ step.label || '执行中' }}</span>
      <span v-if="!isCompleted" class="thinking-dot">
        <span></span>
        <span></span>
        <span></span>
      </span>
      <el-icon v-else class="status-done"><CircleCheckFilled /></el-icon>
    </div>
    <div v-if="streamingText" class="step-content markdown-body" v-html="renderedMarkdown"></div>
    <ResultStep v-if="step.contentType === 'result'" :key="step.id" :step="step" />
    <SearchResultStep v-if="step.contentType === 'searchResult'" :key="step.id" :step="step" />
  </div>
</template>

<script setup lang="ts">
import { CircleCheckFilled, EditPen, MagicStick, Search } from '@element-plus/icons-vue';
import { computed, onMounted, watch } from 'vue';
import { marked } from 'marked';
import ResultStep from './ResultStep.vue';
import SearchResultStep from './SearchResultStep.vue';

const props = defineProps<{
  step: Step;
}>();

const emit = defineEmits<{
  'streaming-complete': [];
}>();

const iconType = computed(() => {
  const icon = props.step.icon;
  if (icon === 'search' || icon === 'pen' || icon === 'brain') return icon;
  return 'brain';
});

const isCompleted = computed(() => props.step.status === 'completed' || props.step.streaming === false);

const streamingText = computed(() => {
  if (typeof props.step.content === 'string' && props.step.content) {
    return props.step.content;
  }
  return '';
});

const renderedMarkdown = computed(() => {
  if (!streamingText.value) return '';
  return marked.parse(streamingText.value, { breaks: true, gfm: true }) as string;
});

onMounted(() => {
  if (props.step.streaming === false) {
    emit('streaming-complete');
  }
});

watch(
  () => props.step.streaming,
  (streaming) => {
    if (streaming === false) emit('streaming-complete');
  },
);
</script>

<style scoped lang="scss">
.common-step {
  width: 100%;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
}

.step-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.step-icon {
  width: 28px;
  height: 28px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &.icon-brain {
    background: rgba(254, 243, 199, 0.35);
    color: #d97706;
  }

  &.icon-search {
    background: rgba(219, 234, 254, 0.35);
    color: #2563eb;
  }

  &.icon-pen {
    background: rgba(220, 252, 231, 0.55);
    color: #16a34a;
  }
}

.step-label {
  flex: 1;
  min-width: 0;
  color: #475569;
  font-size: 14px;
  line-height: 1.6;
}

.thinking-dot {
  display: inline-flex;
  gap: 3px;
  align-items: center;

  span {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #94a3b8;
    animation: blink 1.4s infinite ease-in-out;

    &:nth-child(2) {
      animation-delay: 0.2s;
    }
    &:nth-child(3) {
      animation-delay: 0.4s;
    }
  }
}

.status-done {
  font-size: 18px;
  color: #16a34a;
}

.step-content {
  padding: 8px 12px;
  background: #f8fafc;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.6;
  color: #1f2937;
  word-break: break-word;

  &.markdown-body {
    white-space: normal;

    p {
      margin: 0 0 8px;
      &:last-child {
        margin-bottom: 0;
      }
    }

    code {
      background: rgba(0, 0, 0, 0.06);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 13px;
    }

    pre {
      background: #1e293b;
      color: #e2e8f0;
      padding: 12px 14px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 8px 0;

      code {
        background: transparent;
        padding: 0;
        color: inherit;
        font-size: 13px;
      }
    }

    ul,
    ol {
      margin: 8px 0;
      padding-left: 20px;

      li {
        margin: 4px 0;
      }
    }

    strong {
      font-weight: 600;
    }

    em {
      font-style: italic;
    }

    a {
      color: #2563eb;
      text-decoration: none;
      &:hover {
        text-decoration: underline;
      }
    }

    blockquote {
      border-left: 3px solid #e2e8f0;
      margin: 8px 0;
      padding-left: 12px;
      color: #64748b;
    }

    h1,
    h2,
    h3,
    h4 {
      margin: 12px 0 8px;
      font-weight: 600;
      line-height: 1.4;
    }

    h1 {
      font-size: 18px;
    }
    h2 {
      font-size: 16px;
    }
    h3,
    h4 {
      font-size: 15px;
    }
  }
}

@keyframes blink {
  0%,
  80%,
  100% {
    opacity: 0.3;
    transform: scale(0.82);
  }
  40% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
