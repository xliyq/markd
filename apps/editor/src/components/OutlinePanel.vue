<template>
  <div class="outline-panel">
    <div v-if="items.length === 0" class="sidebar-empty">无标题</div>
    <div v-else class="outline-list">
      <button
        v-for="item in items"
        :key="item.line"
        class="outline-item"
        :style="{ paddingLeft: (item.level - 1) * 14 + 8 + 'px' }"
        :title="item.text"
        @click="emit('jump', item.text)"
      >
        {{ item.text }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
interface OutlineItem { line: number; level: number; text: string; }

defineProps<{ items: OutlineItem[] }>();
const emit = defineEmits<{ jump: [text: string] }>();
</script>

<style scoped>
.outline-panel { padding: 8px 4px; }
.sidebar-empty { padding: 20px 12px; color: var(--text-muted); font-size: 13px; text-align: center; }
.outline-list { display: flex; flex-direction: column; gap: 2px; max-height: 320px; overflow-y: auto; }
.outline-item {
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 13px;
  text-align: left;
  padding: 5px 8px;
  border-radius: 6px;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.outline-item:hover { background: var(--accent-soft); color: var(--accent); }
</style>
