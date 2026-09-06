<template>
  <n-modal
    :show="show"
    preset="card"
    title="👋 欢迎使用 Milkdown 编辑器"
    :mask-closable="false"
    :closable="false"
    :style="{ width: '440px', maxWidth: '92vw' }"
  >
    <div class="welcome-desc">本地优先的 WYSIWYG Markdown 写作工具。数据只存于你的浏览器，离线可用。</div>
    <template #footer>
      <div class="welcome-actions">
        <n-button type="primary" @click="emit('create')">＋ 新建文档</n-button>
        <n-button @click="emit('import')">📥 导入 .md</n-button>
        <n-button @click="emit('quickNote')">⚡ 快速记录</n-button>
        <n-button text @click="emit('skip')">跳过，直接开始 →</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { NModal, NButton } from "naive-ui";

defineProps<{ show: boolean }>();
const emit = defineEmits<{ create: []; import: []; quickNote: []; skip: [] }>();
</script>

<style scoped>
.welcome-desc { color: var(--text-muted); font-size: 13px; line-height: 1.7; }
.welcome-actions { display: flex; flex-wrap: wrap; gap: 8px; }
</style>
