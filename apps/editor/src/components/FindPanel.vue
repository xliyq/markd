<template>
  <div v-if="open" class="find-panel" role="dialog" aria-label="查找与替换" @keydown.esc="emit('close')">
    <div class="find-row">
      <n-input
        :value="query"
        size="small"
        placeholder="查找…"
        aria-label="查找内容"
        style="flex:1"
        @update:value="(v: string) => emit('query', v)"
        @keydown.enter="emit('next')"
      />
      <span class="find-count" aria-live="polite">{{ total > 0 ? `${current}/${total}` : "0" }}</span>
    </div>
    <div class="find-row">
      <n-input
        v-model:value="replacement"
        size="small"
        placeholder="替换为…"
        aria-label="替换为"
        style="width:100%"
        @keydown.enter="emit('replace')"
      />
    </div>
    <div class="find-row">
      <n-button size="small" @click="emit('prev')">上一处</n-button>
      <n-button size="small" @click="emit('next')">下一处</n-button>
      <n-button size="small" @click="emit('replace')">替换</n-button>
      <n-button size="small" type="primary" @click="emit('replaceAll')">全部</n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { NInput, NButton } from "naive-ui";

const props = defineProps<{
  open: boolean;
  query: string;
  replacement: string;
  total: number;
  current: number;
}>();

const emit = defineEmits<{
  close: [];
  query: [v: string];
  next: [];
  prev: [];
  replace: [];
  replaceAll: [];
}>();

const replacement = ref(props.replacement);
watch(() => props.replacement, (v) => { replacement.value = v; });
</script>

<style scoped>
.find-panel {
  position: absolute;
  top: 44px;
  right: 16px;
  z-index: 40;
  width: 300px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-soft);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.find-row { display: flex; align-items: center; gap: 6px; }
.find-count { font-size: 12px; color: var(--text-muted); white-space: nowrap; }
</style>
