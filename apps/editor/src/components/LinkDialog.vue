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
        <span class="settings-label">{{ textLabel }}</span>
        <n-input v-model:value="form.text" size="small" placeholder="显示在编辑器中的文案" style="width: 250px" @keydown.enter="onConfirm" />
      </div>
      <div class="settings-row">
        <span class="settings-label">{{ urlLabel }}</span>
        <n-input v-model:value="form.url" size="small" placeholder="https://…" style="width: 250px" @keydown.enter="onConfirm" />
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
import { reactive, watch } from "vue";
import { NModal, NInput, NButton } from "naive-ui";

const props = defineProps<{
  show: boolean;
  title: string;
  textLabel: string;
  urlLabel: string;
  confirmText: string;
  initialText: string;
  initialUrl: string;
}>();

const emit = defineEmits<{
  "update:show": [v: boolean];
  confirm: [payload: { text: string; url: string }];
}>();

const form = reactive({ text: props.initialText, url: props.initialUrl });
watch(() => props.show, (v) => {
  if (v) { form.text = props.initialText; form.url = props.initialUrl; }
});

function onConfirm() {
  emit("confirm", { text: form.text, url: form.url });
}
</script>

<style scoped>
.settings-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.settings-label { width: 76px; color: var(--text-muted); font-size: 13px; flex-shrink: 0; }
.link-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>
