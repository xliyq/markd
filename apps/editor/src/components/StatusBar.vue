<template>
  <footer class="statusbar" role="status" aria-live="polite">
    <span>{{ statusText }}</span>
    <span class="spacer"></span>
    <span v-if="docStatsText">{{ docStatsText }}</span>
    <span v-if="sourceMode" class="source-badge">源码模式</span>
  </footer>
</template>

<script setup lang="ts">
defineProps<{
  statusText: string;
  docStatsText: string;
  sourceMode: boolean;
}>();
</script>

<style scoped>
.statusbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 5px 14px;
  border-top: 1px solid var(--border-soft);
  background: var(--bg);
  color: var(--text-muted);
  font-size: 12px;
}
.spacer { flex: 1; }
.source-badge {
  color: var(--accent);
  border: 1px solid var(--accent-soft);
  border-radius: 4px;
  padding: 0 6px;
  font-size: 11px;
}
</style>
