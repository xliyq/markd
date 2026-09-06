<template>
  <header class="titlebar" role="banner">
    <span class="app-name">Milkdown 编辑器</span>
    <span class="doc-title" aria-hidden="true">{{ docName }}</span>
    <span class="spacer"></span>
    <button class="toolbar-btn" title="导入 Markdown" @click="emit('import')">导入 .md</button>
    <n-dropdown :options="exportOptions" @select="(k: string) => emit('export', k)">
      <button class="toolbar-btn" title="导出">⬇ 导出 ▾</button>
    </n-dropdown>
    <button class="toolbar-btn" title="切换主题" @click="emit('toggleTheme')">{{ themeLabel }}</button>
    <button class="toolbar-btn" title="设置" @click="emit('openSettings')">⚙</button>
  </header>
</template>

<script setup lang="ts">
import { NDropdown } from "naive-ui";

defineProps<{
  docName: string;
  themeLabel: string;
  exportOptions: { label: string; key: string; disabled?: boolean }[];
}>();

const emit = defineEmits<{
  import: [];
  export: [key: string];
  toggleTheme: [];
  openSettings: [];
}>();
</script>

<style scoped>
.titlebar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--border-soft);
  background: var(--bg);
}
.app-name { font-weight: 700; color: var(--accent); font-size: 15px; }
.doc-title { color: var(--text-muted); font-size: 13px; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.spacer { flex: 1; }
.toolbar-btn {
  border: 1px solid var(--border);
  background: var(--bg-soft);
  color: var(--text);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 13px;
  cursor: pointer;
}
.toolbar-btn:hover { border-color: var(--accent); color: var(--accent); }
</style>
