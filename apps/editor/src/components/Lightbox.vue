<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
      @wheel.prevent="onWheel"
      @click.self="emit('close')"
    >
      <img
        :src="current"
        class="lightbox-img"
        :style="{ transform: `scale(${scale}) translate(${tx}px, ${ty}px)` }"
        alt="预览大图"
        draggable="false"
        @dblclick="resetTransform"
        @pointerdown="onPointerDown"
      />
      <!-- 顶部工具栏 -->
      <div class="lightbox-toolbar">
        <span class="lightbox-count">{{ index + 1 }} / {{ images.length }}</span>
        <button class="lightbox-btn" title="缩小" :disabled="scale <= 0.25" @click="zoomBy(-0.25)">−</button>
        <button class="lightbox-btn" title="放大" :disabled="scale >= 4" @click="zoomBy(0.25)">＋</button>
        <span class="lightbox-sep"></span>
        <button class="lightbox-btn" title="下载" @click="onDownload">⬇</button>
        <button class="lightbox-btn" title="复制图片地址" @click="onCopy">📋</button>
        <button class="lightbox-btn" title="新窗口打开" @click="onOpenNew">↗</button>
        <span class="lightbox-sep"></span>
        <button class="lightbox-close" title="关闭 (Esc)" @click="emit('close')">✕</button>
      </div>
      <!-- 左右切换 -->
      <button v-if="images.length > 1 && index > 0" class="lightbox-nav lightbox-prev" title="上一张 (←)" @click="emit('update:index', index - 1)">‹</button>
      <button v-if="images.length > 1 && index < images.length - 1" class="lightbox-nav lightbox-next" title="下一张 (→)" @click="emit('update:index', index + 1)">›</button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from "vue";

const props = defineProps<{
  /** 图片 URL 列表（已解析为可显示地址） */
  images: string[];
  /** 当前索引 */
  index: number;
}>();

const emit = defineEmits<{
  close: [];
  "update:index": [i: number];
}>();

const visible = computed(() => props.images.length > 0);
const current = computed(() => props.images[props.index] ?? "");

/** 缩放 / 平移状态（双击还原） */
const scale = ref(1);
const tx = ref(0);
const ty = ref(0);
function resetTransform() {
  scale.value = 1;
  tx.value = 0;
  ty.value = 0;
}
function zoomBy(delta: number) {
  scale.value = Math.min(4, Math.max(0.25, scale.value + delta));
}
function onWheel(e: WheelEvent) {
  zoomBy(e.deltaY < 0 ? 0.25 : -0.25);
}

/** 拖拽平移（缩放后拖动看细节） */
let dragging = false;
let lastX = 0;
let lastY = 0;
function onPointerDown(e: PointerEvent) {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  const move = (ev: PointerEvent) => {
    if (!dragging) return;
    tx.value += ev.clientX - lastX;
    ty.value += ev.clientY - lastY;
    lastX = ev.clientX;
    lastY = ev.clientY;
  };
  const up = () => {
    dragging = false;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

/** 下载 / 复制 / 新窗口 */
function onDownload() {
  const a = document.createElement("a");
  a.href = current.value;
  a.download = `image-${props.index + 1}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
async function onCopy() {
  try {
    await navigator.clipboard.writeText(current.value);
  } catch {
    /* 剪贴板不可用时静默 */
  }
}
function onOpenNew() {
  window.open(current.value, "_blank", "noopener");
}

/** 切换图片时还原缩放 */
watch(() => props.index, resetTransform);

/** 键盘：Esc 关闭、←/→ 切换 */
function onKeydown(e: KeyboardEvent) {
  if (!visible.value) return;
  // ⚠️ 必须 preventDefault + stopPropagation：否则 ←/→ 穿透到底层编辑器移动光标（焦点仍在 ProseMirror）
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    emit("close");
  } else if (e.key === "ArrowLeft" && props.index > 0) {
    e.preventDefault();
    e.stopPropagation();
    emit("update:index", props.index - 1);
  } else if (e.key === "ArrowRight" && props.index < props.images.length - 1) {
    e.preventDefault();
    e.stopPropagation();
    emit("update:index", props.index + 1);
  }
}
onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<style scoped>
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: rgba(0, 0, 0, 0.82);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  user-select: none;
}
.lightbox-img {
  max-width: 88vw;
  max-height: 82vh;
  object-fit: contain;
  cursor: grab;
  transition: transform 0.08s linear;
  will-change: transform;
}
.lightbox-img:active { cursor: grabbing; }
.lightbox-toolbar {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(30, 30, 30, 0.75);
  backdrop-filter: blur(4px);
}
.lightbox-count { color: #ccc; font-size: 12px; margin-right: 6px; }
.lightbox-sep { width: 1px; height: 14px; background: rgba(255, 255, 255, 0.2); margin: 0 4px; }
.lightbox-btn, .lightbox-close {
  border: none;
  background: transparent;
  color: #e5e5e5;
  font-size: 14px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  line-height: 1;
}
.lightbox-btn:hover:not(:disabled), .lightbox-close:hover { background: rgba(255, 255, 255, 0.15); }
.lightbox-btn:disabled { color: #666; cursor: default; }
.lightbox-close { font-size: 16px; }
.lightbox-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 60px;
  border: none;
  border-radius: 8px;
  background: rgba(30, 30, 30, 0.6);
  color: #e5e5e5;
  font-size: 28px;
  cursor: pointer;
  line-height: 1;
}
.lightbox-nav:hover { background: rgba(255, 255, 255, 0.15); }
.lightbox-prev { left: 12px; }
.lightbox-next { right: 12px; }
</style>
