<template>
  <div class="material-preview-panel">
    <header class="preview-header">
      <div class="preview-header-row">
        <div class="preview-meta">
          <h2 class="material-title">{{ material?.title || '素材预览' }}</h2>
          <p v-if="material?.url" class="material-url">
            <a :href="material.url" target="_blank" rel="noopener noreferrer">{{ material.url }}</a>
          </p>
        </div>
        <button type="button" class="preview-close" title="关闭" aria-label="关闭" @click="emit('close')">
          <el-icon><Close /></el-icon>
        </button>
      </div>
    </header>

    <div class="preview-scroll">
      <div class="preview-content">
        <div v-if="material?.description" class="material-description">{{ material.description }}</div>
        <div v-if="material?.content" class="material-body" v-html="renderedContent"></div>
        <div v-else class="material-body empty">暂无详细内容</div>
      </div>
    </div>

    <footer class="preview-foot">
      <span class="preview-note"></span>
      <div class="preview-foot-actions">
        <a v-if="material?.url" class="btn-open-link" :href="material.url" target="_blank" rel="noopener noreferrer">
          <el-icon><TopRight /></el-icon>
          打开原文
        </a>
        <button type="button" class="btn-close-panel" @click="emit('close')">关闭</button>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { Close, TopRight } from '@element-plus/icons-vue';
import { marked } from 'marked';
import { computed } from 'vue';

export interface MaterialItem {
  title: string;
  description?: string;
  content?: string;
  url?: string;
}

const props = defineProps<{
  material: MaterialItem | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const renderedContent = computed(() => {
  if (!props.material?.content) return '';
  return marked.parse(props.material.content, { breaks: true, gfm: true }) as string;
});
</script>

<style scoped lang="scss">
$mp-primary: #0b57d0;
$mp-bg: #ffffff;
$mp-text: #262626;
$mp-text-secondary: #8c8c8c;

.material-preview-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: $mp-bg;
}

.preview-header {
  flex-shrink: 0;
  padding: 20px 24px 10px;
  border-bottom: 1px solid #f0f0f0;
}

.preview-header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.preview-meta {
  flex: 1;
  min-width: 0;
}

.material-title {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 700;
  color: #000000;
  line-height: 1.35;
  letter-spacing: 0.01em;
  word-break: break-word;
}

.material-url {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: $mp-text-secondary;
  overflow: hidden;

  a {
    color: $mp-primary;
    text-decoration: none;
    word-break: break-all;

    &:hover {
      text-decoration: underline;
    }
  }
}

.preview-close {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: $mp-text-secondary;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.04);
    color: $mp-text;
  }

  .el-icon {
    font-size: 18px;
  }
}

.preview-scroll {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 20px 24px;
  scrollbar-width: thin;
  scrollbar-color: #d9d9d9 transparent;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: #d9d9d9;
    border-radius: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }
}

.preview-content {
  max-width: 100%;
}

.material-description {
  margin-bottom: 20px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.7;
  color: #475569;
}

.material-body {
  font-size: 15px;
  line-height: 1.8;
  color: $mp-text;
  word-break: break-word;

  &.empty {
    color: $mp-text-secondary;
    font-style: italic;
    text-align: center;
    padding: 40px 0;
  }

  :deep(p) {
    margin: 0 0 12px;
  }

  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4) {
    margin: 20px 0 12px;
    font-weight: 600;
    line-height: 1.4;
    color: #1f2937;
  }

  :deep(h1) {
    font-size: 20px;
  }

  :deep(h2) {
    font-size: 18px;
  }

  :deep(h3),
  :deep(h4) {
    font-size: 16px;
  }

  :deep(ul),
  :deep(ol) {
    margin: 12px 0;
    padding-left: 24px;

    li {
      margin: 6px 0;
    }
  }

  :deep(code) {
    background: rgba(0, 0, 0, 0.06);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    font-size: 14px;
  }

  :deep(pre) {
    background: #1e293b;
    color: #e2e8f0;
    padding: 16px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 16px 0;

    code {
      background: transparent;
      padding: 0;
      color: inherit;
      font-size: 14px;
    }
  }

  :deep(blockquote) {
    border-left: 3px solid #e2e8f0;
    margin: 16px 0;
    padding: 8px 0 8px 16px;
    color: #64748b;
  }

  :deep(a) {
    color: $mp-primary;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  :deep(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;

    th,
    td {
      border: 1px solid #e2e8f0;
      padding: 10px 12px;
      text-align: left;
    }

    th {
      background: #f8fafc;
      font-weight: 600;
    }
  }
}

.preview-foot {
  flex-shrink: 0;
  padding: 16px 24px 20px;
  border-top: 1px solid #f0f0f0;
  background: #ffffff;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.preview-note {
  font-size: 12px;
  color: $mp-text-secondary;
  line-height: 1.5;
  flex: 1;
  min-width: 200px;
}

.preview-foot-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.btn-open-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border: 1px solid $mp-primary;
  border-radius: 24px;
  background: #ffffff;
  font-size: 14px;
  font-weight: 500;
  color: $mp-primary;
  text-decoration: none;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    background 0.15s ease;

  &:hover {
    border-color: #4096ff;
    color: #4096ff;
    background: #f0f7ff;
  }

  .el-icon {
    font-size: 14px;
  }
}

.btn-close-panel {
  padding: 8px 20px;
  background: linear-gradient(135deg, rgba(0, 47, 134, 1), rgba(50, 114, 231, 1));
  color: #ffffff;
  border: none;
  border-radius: 24px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 47, 134, 0.22);
  transition:
    box-shadow 0.18s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.18s cubic-bezier(0.22, 1, 0.36, 1);

  &:hover {
    box-shadow: 0 4px 14px rgba(0, 47, 134, 0.4);
    transform: translateY(-1px);
  }
}
</style>
