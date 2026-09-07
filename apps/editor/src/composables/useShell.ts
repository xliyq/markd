/**
 * 应用壳共享状态（**模块级单例**：refs 定义在模块顶层，所有 use* composable 拿到同一组引用）。
 * boot 在 App onMounted 初始化；statusText 是全局状态栏文本。
 * ⚠️ refs 必须在模块作用域——若在函数内新建，App 与 composable 各持一份，跨域联动全部失效。
 */
import { ref, shallowRef } from "vue";
import type { AppBootstrap } from "../bootstrap";

const boot = shallowRef<AppBootstrap | null>(null);
const statusText = ref("初始化…");
const activeDocId = ref<string | null>(null);
const docName = ref("未命名文档");
const activeId = ref<string | null>(null);
const conflictMsg = ref<string | null>(null);
const copyToast = ref(false);
const sidebarCollapsed = ref(false);
const treeModule = ref<Record<string, unknown> | null>(null);
const fileInput = ref<HTMLInputElement>();
const editorRoot = ref<HTMLElement>();
const treeRef = ref<{ refresh: () => Promise<void> } | null>(null);

export function useShell() {
  return {
    boot,
    statusText,
    activeDocId,
    docName,
    activeId,
    conflictMsg,
    copyToast,
    sidebarCollapsed,
    treeModule,
    fileInput,
    editorRoot,
    treeRef,
  };
}
