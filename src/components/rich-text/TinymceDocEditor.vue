<template>
  <div
    class="tinymce-doc-editor"
    :class="{
      compact: compact,
      'tinymce-doc-editor--panel': variant === 'panel',
      'tinymce-doc-editor--audit': variant === 'audit',
    }"
  >
    <Editor :id="editorId" v-model="editorContent" license-key="gpl" :init="editorInit" :inline="false" :readonly="readonly" />
  </div>
</template>

<script setup lang="ts">
import { parse } from '@/utils/document-parser';
import Editor from '@tinymce/tinymce-vue';
import tinymce from 'tinymce/tinymce';
import { computed, ref, watch } from 'vue';
import { createDocEditorInit, DOC_CONTENT_STYLE_PANEL } from './tinymce/docEditorInit';

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    compact?: boolean;
    /** 紧凑模式下根据内容自适应高度 */
    autoGrow?: boolean;
    readonly?: boolean;
    /** 右侧联动编辑器：灰底上的「纸张」样式与工具栏胶囊按钮 */
    variant?: 'default' | 'panel';
    /**
     * 若传入该 prop（含空字符串），则启用「原文 + document-parser」预览模式：
     * streaming 为 true 时编辑器展示原始文本；结束后 parse 为 HTML。
     * 此模式下内容由内部状态驱动，忽略对 modelValue 的写入（只读展示场景）。
     */
    previewRawBody?: string;
    /** 仅 preview 模式有效：流式过程中不 parse，结束后 parse 并触发 streaming-complete */
    previewStreaming?: boolean;
  }>(),
  {
    modelValue: '',
    compact: false,
    autoGrow: false,
    readonly: false,
    variant: 'default',
    previewStreaming: false,
  },
);

const emit = defineEmits<{
  'update:modelValue': [string];
  'streaming-complete': [];
  'editor-ready': [];
}>();

const editorId = `tinymce-editor-${Date.now()}`;

// 辅助函数：转义正则表达式特殊字符
const escapeRegExp = (string: string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// 存储所有高亮标记的 Map，key 为位置信息
const highlightMarkers: Map<string, HTMLElement> = new Map();

// 暴露方法给父组件
defineExpose({
  // 一次性高亮所有错误
  highlightAllErrors: (errors: Array<{ position: number; word: string }>) => {
    const editor = tinymce.get(editorId);
    if (!editor) {
      console.warn('TinyMCE editor not found:', editorId);
      return;
    }

    // 清除之前的高亮
    highlightMarkers.forEach((marker) => {
      const parent = marker.parentNode;
      if (parent) {
        while (marker.firstChild) {
          parent.insertBefore(marker.firstChild, marker);
        }
        parent.removeChild(marker);
      }
    });
    highlightMarkers.clear();

    // 批量添加高亮
    errors.forEach((error) => {
      const marker = createHighlightMarker(editor, error.position, error.word);
      if (marker) {
        highlightMarkers.set(String(error.position), marker);
      }
    });
  },

  // 聚焦并高亮某个错误
  focusError: (position: number, word: string) => {
    const editor = tinymce.get(editorId);
    if (!editor) {
      console.warn('TinyMCE editor not found:', editorId);
      return;
    }

    // 将所有标记设为普通状态
    highlightMarkers.forEach((marker) => {
      marker.classList.remove('custom-highlight-active');
      marker.classList.add('custom-highlight-marker');
    });

    // 将目标标记设为激活状态
    const targetMarker = highlightMarkers.get(String(position));
    if (targetMarker) {
      targetMarker.classList.remove('custom-highlight-marker');
      targetMarker.classList.add('custom-highlight-active');
      requestAnimationFrame(() => {
        editor.selection.scrollIntoView(targetMarker, true);
      });
    }
  },

  // 移除某个错误的标记
  removeHighlight: (position: number) => {
    const marker = highlightMarkers.get(String(position));
    if (marker) {
      const parent = marker.parentNode;
      if (parent) {
        while (marker.firstChild) {
          parent.insertBefore(marker.firstChild, marker);
        }
        parent.removeChild(marker);
      }
      highlightMarkers.delete(String(position));
    }
  },

  highlightWord: (word: string, position?: number) => {
    const editor = tinymce.get(editorId);
    if (!editor) {
      console.warn('TinyMCE editor not found:', editorId);
      return;
    }

    // 清除之前的高亮
    highlightMarkers.forEach((marker) => {
      const parent = marker.parentNode;
      if (parent) {
        while (marker.firstChild) {
          parent.insertBefore(marker.firstChild, marker);
        }
        parent.removeChild(marker);
      }
    });
    highlightMarkers.clear();

    if (position !== undefined && position >= 0) {
      // 使用精确位置高亮
      const marker = createHighlightMarker(editor, position, word);
      if (marker) {
        highlightMarkers.set(String(position), marker);
        marker.classList.remove('custom-highlight-marker');
        marker.classList.add('custom-highlight-active');
        requestAnimationFrame(() => {
          editor.selection.scrollIntoView(marker, true);
        });
      }
    }
  },

  replaceWord: (oldWord: string, newWord: string) => {
    const editor = tinymce.get(editorId);
    if (!editor) {
      console.warn('TinyMCE editor not found:', editorId);
      return;
    }

    const content = editor.getContent();
    const correctedContent = content.replace(new RegExp(escapeRegExp(oldWord), 'g'), newWord);
    editor.setContent(correctedContent);
  },

  // 在指定位置替换文本
  replaceWordAt: (position: number, oldWord: string, newWord: string) => {
    const editor = tinymce.get(editorId);
    if (!editor) {
      console.warn('TinyMCE editor not found:', editorId);
      return;
    }

    const body = editor.getBody();
    const textNodes: Array<{ node: Text; offset: number }> = [];
    let currentOffset = 0;

    // 收集所有文本节点
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        textNodes.push({ node: node as Text, offset: currentOffset });
        currentOffset += (node as Text).length;
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          walk(node.childNodes[i]);
        }
      }
    };
    walk(body);

    // 找到目标文本节点并替换
    for (const { node, offset } of textNodes) {
      const nodeLength = node.length;
      const targetInNode = position - offset;

      if (targetInNode >= 0 && targetInNode < nodeLength) {
        const textContent = node.textContent || '';
        const beforeText = textContent.substring(0, targetInNode);
        const afterText = textContent.substring(targetInNode + oldWord.length);
        node.textContent = beforeText + newWord + afterText;
        editor.nodeChanged();
        break;
      }
    }
  },

  // 在指定位置删除文本
  deleteWordAt: (position: number, word: string) => {
    const editor = tinymce.get(editorId);
    if (!editor) {
      console.warn('TinyMCE editor not found:', editorId);
      return;
    }

    // 移除对应的高亮标记
    const marker = highlightMarkers.get(String(position));
    if (marker) {
      const parent = marker.parentNode;
      if (parent) {
        while (marker.firstChild) {
          parent.insertBefore(marker.firstChild, marker);
        }
        parent.removeChild(marker);
      }
      highlightMarkers.delete(String(position));
    }

    const body = editor.getBody();
    const textNodes: Array<{ node: Text; offset: number }> = [];
    let currentOffset = 0;

    // 收集所有文本节点
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        textNodes.push({ node: node as Text, offset: currentOffset });
        currentOffset += (node as Text).length;
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          walk(node.childNodes[i]);
        }
      }
    };
    walk(body);

    // 找到目标文本节点并删除
    for (const { node, offset } of textNodes) {
      const nodeLength = node.length;
      const targetInNode = position - offset;

      if (targetInNode >= 0 && targetInNode < nodeLength) {
        const textContent = node.textContent || '';
        const beforeText = textContent.substring(0, targetInNode);
        const afterText = textContent.substring(targetInNode + word.length);
        node.textContent = beforeText + afterText;
        editor.nodeChanged();
        break;
      }
    }
  },

  // 清除高亮
  clearHighlight: () => {
    highlightMarkers.forEach((marker) => {
      const parent = marker.parentNode;
      if (parent) {
        while (marker.firstChild) {
          parent.insertBefore(marker.firstChild, marker);
        }
        parent.removeChild(marker);
      }
    });
    highlightMarkers.clear();
  },
});

// 创建高亮标记
const createHighlightMarker = (editor: any, charIndex: number, word: string): HTMLElement | null => {
  const body = editor.getBody();
  const textNodes: Array<{ node: Text; offset: number }> = [];
  let currentOffset = 0;

  // 收集所有文本节点
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      textNodes.push({ node: node as Text, offset: currentOffset });
      currentOffset += (node as Text).length;
    } else {
      for (let i = 0; i < node.childNodes.length; i++) {
        walk(node.childNodes[i]);
      }
    }
  };
  walk(body);

  // 找到目标文本节点
  for (const { node, offset } of textNodes) {
    const nodeLength = node.length;
    const targetInNode = charIndex - offset;

    if (targetInNode >= 0 && targetInNode < nodeLength) {
      const endInNode = Math.min(targetInNode + word.length, nodeLength);

      const marker = editor.dom.create('span', { class: 'custom-highlight-marker' });
      const range = document.createRange();
      range.setStart(node, targetInNode);
      range.setEnd(node, endInNode);

      try {
        range.surroundContents(marker);
        return marker;
      } catch (e) {
        console.warn('Failed to surround contents:', e);
        return null;
      }
    }
  }
  return null;
};

// 清除高亮
const clearHighlights = (editor: any) => {
  highlightMarkers.forEach((marker) => {
    const parent = marker.parentNode;
    if (parent) {
      while (marker.firstChild) {
        parent.insertBefore(marker.firstChild, marker);
      }
      parent.removeChild(marker);
    }
  });
  highlightMarkers.clear();

  // 清除残留标记
  const oldMarkers = editor.dom.select('.custom-highlight-marker, .custom-highlight-active');
  oldMarkers.forEach((marker: any) => {
    const parent = marker.parentNode;
    if (parent) {
      while (marker.firstChild) {
        parent.insertBefore(marker.firstChild, marker);
      }
      parent.removeChild(marker);
    }
  });
};

const isPreviewMode = computed(() => props.previewRawBody !== undefined);

/** preview 模式：parse 后的 HTML 或流式中的原文 */
const previewBody = ref('');
const lastFormattedSource = ref('');

const formatPreviewBody = (rawText: string) => {
  if (lastFormattedSource.value === rawText) return;
  previewBody.value = parse(rawText || '');
  lastFormattedSource.value = rawText || '';
};

watch(
  () => props.previewRawBody,
  (body) => {
    if (!isPreviewMode.value) return;
    const text = body ?? '';
    if (props.previewStreaming === true) {
      previewBody.value = text;
      return;
    }
    formatPreviewBody(text);
  },
  { immediate: true },
);

watch(
  () => props.previewStreaming,
  (streaming) => {
    if (!isPreviewMode.value) return;
    if (streaming === true) return;
    formatPreviewBody(props.previewRawBody ?? '');
    emit('streaming-complete');
  },
  { immediate: true },
);

const editorContent = computed({
  get: () => (isPreviewMode.value ? previewBody.value : props.modelValue),
  set: (v: string) => {
    if (isPreviewMode.value) return;
    emit('update:modelValue', v);
  },
});

const MATCH_MARKER_STYLE = `
  .mce-match-marker {
    background: #ffeb3b;
    color: inherit;
    padding: 1px 3px;
    border-radius: 4px;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }
  .mce-match-marker-selected {
    background: #f44336;
    color: white;
  }
  .custom-highlight-marker {
    background: rgba(255, 235, 59, 0.5);
    color: inherit;
    padding: 1px 3px;
    border-radius: 4px;
  }
  .custom-highlight-active {
    background: #ffeb3b;
    color: inherit;
    padding: 1px 3px;
    border-radius: 4px;
    box-shadow: 0 0 0 2px rgba(255, 193, 7, 0.5);
  }
`;

const editorInit = computed(() => {
  const onInitCallback = () => {
    emit('editor-ready');
  };

  if (props.variant === 'audit') {
    return createDocEditorInit({
      content_style: `${DOC_CONTENT_STYLE_PANEL}\n${MATCH_MARKER_STYLE}`,
      min_height: 500,
      height: '100%',
      autoresize_min_height: 500,
      autoresize_bottom_margin: 24,
      statusbar: false,
      resize: false,
      fontsize_formats: '12pt 14pt 三号=16pt 18pt 20pt',
      init_instance_callback: onInitCallback,
    });
  }

  if (props.variant === 'panel') {
    return createDocEditorInit({
      content_style: `${DOC_CONTENT_STYLE_PANEL}\n${MATCH_MARKER_STYLE}`,
      min_height: 380,
      autoresize_min_height: 380,
      autoresize_bottom_margin: 24,
      statusbar: false,
      resize: true,
      fontsize_formats: '12pt 14pt 三号=16pt 18pt 20pt',
      init_instance_callback: onInitCallback,
    });
  }
  return createDocEditorInit(
    props.compact
      ? props.autoGrow
        ? {
            min_height: 260,
            autoresize_min_height: 260,
            autoresize_bottom_margin: 24,
            plugins: 'lists link',
            resize: false,
            init_instance_callback: onInitCallback,
          }
        : {
            min_height: 260,
            height: 680,
            plugins: 'lists link',
            resize: false,
            init_instance_callback: onInitCallback,
          }
      : {
          min_height: 420,
          autoresize_min_height: 420,
          init_instance_callback: onInitCallback,
        },
  );
});
</script>

<style scoped lang="scss">
.tinymce-doc-editor {
  width: 100%;
  height: 100%;

  &:not(.tinymce-doc-editor--panel):not(.tinymce-doc-editor--audit) :deep(.tox-tinymce) {
    border-radius: 8px;
    border-color: #e2e8f0 !important;
  }

  &.compact :deep(.tox-tinymce) {
    border-radius: 8px;
  }

  &.tinymce-doc-editor--panel {
    width: 100%;
  }

  &.tinymce-doc-editor--audit {
    width: 100%;
    height: 100%;

    :deep(.tox-tinymce) {
      border: none;
      min-height: 100%;
      height: 100% !important;
    }
  }

  :deep(.tox-tinymce) {
    min-height: 500px;
    height: 100% !important;
    .tox-edit-area::before {
      display: none;
    }

    .tox-statusbar {
      display: none;
    }
  }
}
</style>
