<script setup lang="ts">
/**
 * 通用输入/确认对话框（替代 window.prompt / window.confirm）—— Naive UI 版
 *
 * 模式：
 *  - input：带输入框（新建/重命名，确认后 emit('confirm', value)）
 *  - confirm：纯确认（删除，emit('confirm')）
 * Props 变化自动打开；关闭时重置内部状态。
 */
import { ref, watch } from "vue";
import { NModal, NInput, NButton } from "naive-ui";

const props = defineProps<{
  /** 控制显隐 */
  open: boolean;
  /** 对话框标题 */
  title: string;
  /** 输入模式（不传或空 = 纯确认模式） */
  message?: string;
  /** 输入框 placeholder */
  placeholder?: string;
  /** 输入框初始值 */
  initialValue?: string;
  /** 确认按钮文案 */
  confirmText?: string;
  /** 危险操作（删除）：确认按钮红色 */
  danger?: boolean;
}>();

const emit = defineEmits<{
  (e: "confirm", value: string): void;
  (e: "cancel"): void;
}>();

const inputValue = ref(props.initialValue ?? "");
const inputEl = ref<InstanceType<typeof NInput> | null>(null);

/** open 变为 true（每次打开）时重置输入值并聚焦 */
watch(
  () => props.open,
  (v) => {
    if (v) {
      inputValue.value = props.initialValue ?? "";
      requestAnimationFrame(() => inputEl.value?.focus());
    }
  },
);

function onConfirm() {
  emit("confirm", inputValue.value);
}
function onCancel() {
  emit("cancel");
}
/** n-modal 关闭（Esc/遮罩点击）→ 取消 */
function onShowChange(v: boolean) {
  if (!v) onCancel();
}
</script>

<template>
  <n-modal
    preset="card"
    :show="open"
    :title="title"
    :style="{ width: '420px', maxWidth: '90vw' }"
    @update:show="onShowChange"
  >
    <div v-if="message" class="dialog-message">{{ message }}</div>
    <n-input
      v-if="initialValue !== undefined || placeholder !== undefined"
      ref="inputEl"
      v-model:value="inputValue"
      class="dialog-input"
      :placeholder="placeholder"
      :aria-label="title"
      @keydown.enter="onConfirm"
    />
    <template #footer>
      <div class="dialog-actions">
        <n-button size="small" @click="onCancel">取消</n-button>
        <n-button size="small" :type="danger ? 'error' : 'primary'"" @click="onConfirm">
          {{ confirmText || "确定" }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.dialog-message {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 14px;
  line-height: 1.6;
}
.dialog-input {
  width: 100%;
  margin-bottom: 4px;
}
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
