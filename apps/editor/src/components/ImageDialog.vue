<template>
  <n-modal
    :show="show"
    preset="card"
    :title="title"
    :style="{ width: '440px', maxWidth: '92vw' }"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <div class="link-dialog">
      <div class="settings-row">
        <span class="settings-label">图片地址</span>
        <n-input :value="src" size="small" placeholder="https://… 或上传后自动填入" style="width: 250px" @update:value="(v: string) => emit('update:src', v)" @keydown.enter="onConfirm" />
      </div>
      <div class="settings-row">
        <span class="settings-label">本地上传</span>
        <n-button size="small" @click="fileInput?.click()">📁 选择文件…</n-button>
        <input ref="fileInput" type="file" accept="image/*" style="display: none" @change="onFilePicked" />
      </div>
    </div>
    <template #footer>
      <div class="link-dialog-actions">
        <n-button size="small" @click="emit('update:show', false)">取消</n-button>
        <n-button size="small" type="primary" @click="onConfirm">{{ confirmText }}</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { NModal, NInput, NButton } from "naive-ui";

defineProps<{
  show: boolean;
  title: string;
  confirmText: string;
  src: string;
}>();

const emit = defineEmits<{
  "update:show": [v: boolean];
  "update:src": [v: string];
  upload: [file: File];
  confirm: [];
}>();

const fileInput = ref<HTMLInputElement>();
function onFilePicked(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) emit("upload", f);
  (e.target as HTMLInputElement).value = "";
}
function onConfirm() {
  emit("confirm");
}
</script>

<style scoped>
.settings-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.settings-label { width: 76px; color: var(--text-muted); font-size: 13px; flex-shrink: 0; }
.link-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>
