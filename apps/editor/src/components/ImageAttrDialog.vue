<template>
  <n-modal
    :show="show"
    preset="card"
    title="图片属性"
    :style="{ width: '420px', maxWidth: '92vw' }"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <div class="image-attr-dialog">
      <div class="settings-row">
        <span class="settings-label">替代文本</span>
        <n-input
          v-model:value="form.alt"
          size="small"
          placeholder="alt（无障碍描述）"
          style="width: 240px"
          @keydown.enter="onConfirm"
        />
      </div>
      <div class="settings-row">
        <span class="settings-label">悬停标题</span>
        <n-input
          v-model:value="form.title"
          size="small"
          placeholder="title（鼠标悬停提示）"
          style="width: 240px"
          @keydown.enter="onConfirm"
        />
      </div>
    </div>
    <template #footer>
      <div class="link-dialog-actions">
        <n-button size="small" @click="emit('update:show', false)">取消</n-button>
        <n-button size="small" type="primary" @click="onConfirm">确定</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { reactive, watch } from "vue";
import { NModal, NInput, NButton } from "naive-ui";

const props = defineProps<{
  show: boolean;
  initialAlt: string;
  initialTitle: string;
}>();

const emit = defineEmits<{
  "update:show": [v: boolean];
  confirm: [payload: { alt: string; title: string }];
}>();

const form = reactive({ alt: "", title: "" });
watch(
  () => props.show,
  (v) => {
    if (v) {
      form.alt = props.initialAlt;
      form.title = props.initialTitle;
    }
  },
  { immediate: true },
);

function onConfirm() {
  emit("confirm", { alt: form.alt, title: form.title });
}
</script>
