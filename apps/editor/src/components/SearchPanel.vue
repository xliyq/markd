<template>
  <div v-if="open" class="search-panel" role="dialog" aria-label="全文搜索" @keydown.esc="emit('close')">
    <div class="find-row">
      <n-input
        :value="query"
        size="small"
        placeholder="搜索全部文档…（Ctrl+Shift+F）"
        aria-label="搜索全部文档"
        clearable
        style="flex:1"
        @update:value="(v: string) => emit('query', v)"
        @keydown.enter="results[0] && emit('open', results[0].id)"
      />
      <span class="find-count" aria-live="polite">{{ total }}</span>
    </div>
    <div v-if="results.length === 0 && query.trim()" class="search-empty">无结果</div>
    <div v-else class="search-list">
      <button
        v-for="r in results"
        :key="r.id"
        class="search-item"
        @click="emit('open', r.id)"
      >
        <span class="search-name">{{ r.name }}</span>
        <span class="search-snippet">{{ r.snippet }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NInput } from "naive-ui";

interface SearchResult { id: string; name: string; snippet: string; }

defineProps<{
  open: boolean;
  query: string;
  total: number;
  results: SearchResult[];
}>();

const emit = defineEmits<{
  close: [];
  query: [v: string];
  open: [id: string];
}>();
</script>

<style scoped>
.search-panel {
  position: absolute;
  top: 44px;
  right: 16px;
  z-index: 40;
  width: 340px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-soft);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}
.find-row { display: flex; align-items: center; gap: 6px; }
.find-count { font-size: 12px; color: var(--text-muted); white-space: nowrap; }
.search-empty { padding: 12px; color: var(--text-muted); font-size: 13px; text-align: center; }
.search-list { margin-top: 8px; max-height: 280px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.search-item { display: flex; flex-direction: column; gap: 2px; text-align: left; border: none; background: transparent; padding: 6px 8px; border-radius: 6px; cursor: pointer; color: var(--text); }
.search-item:hover { background: var(--accent-soft); }
.search-name { font-size: 13px; font-weight: 600; }
.search-snippet { font-size: 12px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
