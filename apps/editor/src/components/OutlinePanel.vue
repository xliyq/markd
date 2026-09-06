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
/* 大纲占满侧边栏剩余高度（flex 填充），超高才整栏滚动——不再被 320px 限高压缩 */
.outline-panel { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 4px; }
.sidebar-empty { padding: 20px 12px; color: var(--text-muted); font-size: 13px; text-align: center; }
.outline-list { display: flex; flex-direction: column; gap: 2px; }
.outline-item {
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 13px;
  line-height: 1.6;
  text-align: left;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.outline-item:hover { background: var(--accent-soft); color: var(--accent); }
</style>
