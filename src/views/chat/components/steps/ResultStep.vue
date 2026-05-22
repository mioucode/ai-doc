<template>
  <div class="result-step">
    <div class="result-items">
      <div v-for="(item, idx) in content.tasks || []" :key="idx" class="result-item">
        <div class="item-title">{{ item.title }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';

const props = defineProps<{
  step: Step;
}>();

const emit = defineEmits<{
  'streaming-complete': [];
}>();

const content = computed(() => (props.step.content || {}) as Record<string, any>);

watch(
  () => props.step,
  (newStep) => {
    console.log('[ResultStep] Step updated:', JSON.stringify(newStep, null, 2));
    console.log('[ResultStep] Content tasks:', content.value.tasks);
  },
  { deep: true, immediate: true },
);

onMounted(() => {
  emit('streaming-complete');
});
</script>

<style scoped lang="scss">
.result-step {
  width: 100%;
}

.result-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 12px;
  background: #f8fafc;
  border-radius: 8px;
}

.result-item {
  font-size: 14px;
  line-height: 1.6;
  color: #1f2937;
}

.item-title {
  font-size: 14px;
  color: #1f2937;
}
</style>
