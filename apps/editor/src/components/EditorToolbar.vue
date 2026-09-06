<template>
<div class="editor-toolbar" role="toolbar" aria-label="编辑工具栏">
            <div class="toolbar-group">
              <n-button size="small" title="一级标题" @mousedown.capture.prevent @click="emit('toolbar', 'heading1')">H1</n-button>
              <n-button size="small" title="二级标题" @mousedown.capture.prevent @click="emit('toolbar', 'heading2')">H2</n-button>
              <n-button size="small" title="三级标题" @mousedown.capture.prevent @click="emit('toolbar', 'heading3')">H3</n-button>
              <n-button size="small" title="正文" @mousedown.capture.prevent @click="emit('toolbar', 'paragraph')">¶</n-button>
            </div>
            <span class="toolbar-sep" aria-hidden="true"></span>
            <div class="toolbar-group">
              <n-button size="small" title="加粗 (Ctrl+B)" @mousedown.capture.prevent @click="emit('toolbar', 'bold')"><b>B</b></n-button>
              <n-button size="small" title="斜体 (Ctrl+I)" @mousedown.capture.prevent @click="emit('toolbar', 'italic')"><i>I</i></n-button>
              <n-button size="small" title="行内代码" @mousedown.capture.prevent @click="emit('toolbar', 'code')">`</n-button>
              <n-button size="small" title="插入链接" @mousedown.capture.prevent @click="emit('toolbar', 'link')">🔗</n-button>
              <n-button size="small" title="插入图片" @mousedown.capture.prevent @click="emit('toolbar', 'image')">🖼</n-button>
            </div>
            <span class="toolbar-sep" aria-hidden="true"></span>
            <div class="toolbar-group">
              <n-button size="small" title="引用" @mousedown.capture.prevent @click="emit('toolbar', 'blockquote')">❝</n-button>
              <n-button size="small" title="代码块" @mousedown.capture.prevent @click="emit('toolbar', 'codeblock')">{}</n-button>
              <n-button size="small" title="分割线" @mousedown.capture.prevent @click="emit('toolbar', 'hr')">―</n-button>
              <n-button size="small" title="无序列表" @mousedown.capture.prevent @click="emit('toolbar', 'bulletList')">•≡</n-button>
              <n-button size="small" title="有序列表" @mousedown.capture.prevent @click="emit('toolbar', 'orderedList')">1≡</n-button>
              <n-button size="small" title="插入表格" @mousedown.capture.prevent @click="emit('toolbar', 'table')">⊞</n-button>
            </div>
            <span class="toolbar-sep" aria-hidden="true"></span>
            <div class="toolbar-group">
              <n-button size="small" :type="sourceMode ? 'primary' : 'default'" ghost :title="sourceMode ? '返回可视化编辑' : '源码编辑'" @mousedown.capture.prevent @click="emit('toggleSource')">{{ sourceMode ? '📝 可视化' : '</> 源码' }}</n-button>
            </div>
          </div>
</template>

<script setup lang="ts">
import { NButton } from "naive-ui";

defineProps<{ sourceMode: boolean }>();

const emit = defineEmits<{
  toolbar: [key: string];
  toggleSource: [];
}>();
</script>

<style scoped>
.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border-soft);
  background: var(--bg);
  flex-wrap: wrap;
}
.toolbar-group { display: flex; align-items: center; gap: 4px; }
.toolbar-sep { width: 1px; height: 18px; background: var(--border-soft); margin: 0 4px; }
</style>
