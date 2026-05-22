<template>
  <div class="agent-step" :class="{ open: isOpen }">
    <div class="step-header" :class="{ clickable: hasContent }" @click="toggleStep">
      <div class="step-icon search-result">
        <el-icon><Document /></el-icon>
      </div>
      <span class="step-label">
        <span class="step-prefix">检索结果</span>
        <span v-if="items.length > 0" class="result-count">{{ items.length }} 条</span>
      </span>
      <el-icon v-if="hasContent" class="step-chevron"><ArrowDown /></el-icon>
    </div>
    <div v-if="hasContent && isOpen" class="step-content">
      <p v-if="content.description" class="result-description">{{ content.description }}</p>
      <div class="result-list">
        <article v-for="(item, idx) in displayedItems" :key="idx" class="result-card" @click="openMaterial(item)">
          <h5 class="article-title">{{ item.title }}</h5>
          <p class="article-desc" :title="item.description || ''">{{ item.description }}</p>
          <div class="card-actions">
            <button type="button" class="btn-preview" @click.stop="openMaterial(item)">
              <el-icon><View /></el-icon>
              预览
            </button>
            <a v-if="item.url" class="article-link" :href="item.url" target="_blank" rel="noopener noreferrer" @click.stop>
              打开原文
              <el-icon><TopRight /></el-icon>
            </a>
          </div>
        </article>
      </div>
      <button v-if="hasMoreItems" type="button" class="btn-show-more" @click="showAllItems = true">
        <el-icon><ArrowDown /></el-icon>
        查看更多（剩余 {{ remainingCount }} 条）
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowDown, Document, TopRight, View } from '@element-plus/icons-vue';
import { computed, inject, onMounted, ref } from 'vue';
import { MATERIAL_PREVIEW_KEY, type MaterialItem } from '../../linkedEditor';

const props = defineProps<{
  step: Step;
}>();

const emit = defineEmits<{
  'streaming-complete': [];
}>();

const materialPreviewHost = inject(MATERIAL_PREVIEW_KEY, null);

const isOpen = ref(true);
const showAllItems = ref(false);
const DEFAULT_DISPLAY_COUNT = 3;

const content = computed(() => (props.step.content || {}) as Record<string, any>);
const items = computed(() => content.value.items || []);
const hasContent = computed(() => {
  return Boolean(content.value.title || content.value.description || items.value.length);
});

const hasMoreItems = computed(() => !showAllItems.value && items.value.length > DEFAULT_DISPLAY_COUNT);
const remainingCount = computed(() => Math.max(0, items.value.length - DEFAULT_DISPLAY_COUNT));

const displayedItems = computed(() => {
  if (showAllItems.value || items.value.length <= DEFAULT_DISPLAY_COUNT) {
    return items.value;
  }
  return items.value.slice(0, DEFAULT_DISPLAY_COUNT);
});

onMounted(() => {
  emit('streaming-complete');
});

const toggleStep = () => {
  if (hasContent.value) {
    isOpen.value = !isOpen.value;
  }
};

const openMaterial = (item: any) => {
  if (!materialPreviewHost) return;
  const material: MaterialItem = {
    title: item.title || '未命名素材',
    description: item.description || '',
    content: item.content || item.fullContent || '',
    url: item.url || '',
  };
  materialPreviewHost.open(material);
};
</script>

<style scoped lang="scss">
.agent-step {
  width: 100%;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.step-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  font-size: 14px;
  color: #64748b;
  line-height: 1.6;
  user-select: none;
  cursor: default;

  &.clickable {
    cursor: pointer;
    transition: background 0.18s ease;
    &:hover {
      background: rgba(240, 244, 249, 0.72);
    }
  }
}

.step-icon {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;

  &.search-result {
    background: rgba(30, 136, 229, 0.15);
    color: #0b57d0;
  }
}

.step-label {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;

  .step-prefix {
    color: #64748b;
    font-weight: 500;
  }

  .result-count {
    background: #f1f5f9;
    color: #64748b;
    font-size: 12px;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: 10px;
  }
}

.step-chevron {
  font-size: 18px;
  color: var(--on-surface-variant);
  transition: transform 0.2s ease;
}

.agent-step.open .step-chevron {
  transform: rotate(180deg);
}

.step-content {
  border-top: 1px solid rgba(227, 227, 227, 0.84);
  padding: 14px 16px 16px;
  background: rgba(255, 255, 255, 0.82);
}

.result-title {
  margin: 0 0 8px;
  font-size: 16px;
  line-height: 1.35;
  color: #1f1f1f;
  font-weight: 700;
}

.result-description {
  margin: 0 0 13px;
  font-size: 14px;
  line-height: 1.7;
  color: #555;
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.result-card {
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  background: #fff;
  padding: 18px 20px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #0b57d0;
    box-shadow: 0 2px 8px rgba(11, 87, 208, 0.1);
  }
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 10px;
}

.btn-preview {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #e8f0fe;
  color: #0b57d0;
  border: none;
  border-radius: 16px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: #d2e3fc;
  }

  .el-icon {
    font-size: 14px;
  }
}

.article-title {
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 1.35;
  color: #1f1f1f;
}

.article-desc {
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 1.6;
  color: #666;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
}

.article-link {
  color: #0b57d0;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;

  .el-icon {
    top: 2px;
  }
}

.btn-show-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  margin-top: 12px;
  padding: 10px 16px;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #f1f5f9;
    border-color: #0b57d0;
    color: #0b57d0;
  }

  .el-icon {
    font-size: 14px;
    transition: transform 0.2s ease;
  }

  &:hover .el-icon {
    transform: translateY(2px);
  }
}
</style>
