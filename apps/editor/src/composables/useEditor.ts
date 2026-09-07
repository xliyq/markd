/**
 * 编辑器生命周期与文档编排：挂载/重建/打开文档、大纲与字数、源码切换、图片预览。
 * 依赖 useShell 的单例（boot/statusText/activeDocId/docName）。
 */
import { ref, computed } from "vue";
import type { DocNode } from "@editor/shared";
import { parseOutline, countStats } from "@editor/plugins-app";
import type { OutlineItem, DocStats } from "@editor/plugins-app";
import { runToolbarAction } from "@editor/plugins-editor";
import type { ToolbarAction } from "@editor/plugins-editor";
import { useShell } from "./useShell";

export function useEditor() {
  const { boot, statusText, activeDocId, docName, activeId, editorRoot } = useShell();

  const docTitle = computed(() => docName.value);

  /** 大纲（doc:changed 事件实时更新） */
  const outline = ref<OutlineItem[]>([]);
  /** 侧边栏页签（文档树 / 大纲） */
  const sidebarTab = ref<"docs" | "outline">("docs");

  /** 字数统计 */
  const docStats = ref<DocStats>({ chars: 0, cjkChars: 0, words: 0, lines: 0, headings: 0 });
  const statsText = computed(() => {
    const s = docStats.value;
    return `${s.chars} 字符 · ${s.cjkChars} 中文 · ${s.words} 词 · ${s.headings} 标题`;
  });

  /** 最近一次编辑器 Markdown（重建编辑器/切换插件即时生效用） */
  const lastMarkdown = ref("");

  /** 订阅文档变更 → 更新大纲 + 字数 */
  function onDocChanged(markdown: string) {
    outline.value = parseOutline(markdown);
    docStats.value = countStats(markdown);
    lastMarkdown.value = markdown;
  }

  /** 顶部工具栏动作（focus 编辑器后执行；naive n-button 会抢焦点） */
  function focusEditor() {
    editorRoot.value?.querySelector<HTMLElement>(".ProseMirror")?.focus();
  }
  async function onToolbar(action: ToolbarAction) {
    focusEditor();
    await runToolbarAction(action);
    focusEditor();
  }

  /** 源码编辑模式（WYSIWYG ↔ Markdown 源码切换） */
  const sourceMode = ref(false);
  const sourceText = ref("");
  function toggleSourceMode() {
    if (!boot.value) return;
    const inst = boot.value.editor;
    if (!sourceMode.value) {
      sourceText.value = inst?.getMarkdown() ?? lastMarkdown.value;
      sourceMode.value = true;
      statusText.value = "源码编辑模式（切回可视化后自动应用并保存）";
    } else {
      inst?.replaceMarkdown(sourceText.value);
      sourceMode.value = false;
      lastMarkdown.value = sourceText.value;
      onDocChanged(sourceText.value);
      focusEditor();
      statusText.value = "已应用源码并返回可视化编辑";
    }
  }
  /** 切换文档/重建前先把未应用的源码写回编辑器（避免丢改动） */
  function flushSourceBeforeSwitch() {
    if (sourceMode.value && boot.value?.editor) {
      const md = sourceText.value;
      boot.value.editor.replaceMarkdown(md);
      lastMarkdown.value = md;
      sourceMode.value = false;
    }
  }

  /** 重建编辑器（L1 插件变更即时生效；内容取自 lastMarkdown） */
  async function rebuildEditor() {
    const b = boot.value;
    if (!b) return;
    const md = lastMarkdown.value;
    const docId = b.getCurrentDocId();
    await b.unmountEditor();
    await b.mountEditor(editorRoot.value as HTMLElement, md, docId ?? undefined);
  }

  /**
   * 灯箱预览（M4.6）：点击编辑器内图片 → 全屏灯箱（缩放/平移/多图切换/下载复制）。
   * 打开时收集文档内全部图片（milkdown-image / image-block）→ 支持 ←/→ 切换。
   */
  const previewImg = ref<{ images: string[]; index: number } | null>(null);
  /** 统一开灯箱：收集文档内全部图片 → 定位当前 src */
  async function openLightbox(src: string) {
    if (!src) return;
    const all = Array.from(
      editorRoot.value?.querySelectorAll<HTMLElement>(".milkdown-image-block img, .milkdown-image img") ?? [],
    )
      .map((im) => im.getAttribute("src") || "")
      .filter(Boolean);
    let index = all.indexOf(src);
    if (index < 0) {
      let url = src;
      if (src.startsWith("assets/")) {
        const imgMgr = (boot.value?.api as never as Record<string, unknown>).imageManager as
          | { getBlobUrl?: (docId: string, relPath: string) => Promise<string> }
          | undefined;
        const docId = boot.value?.getCurrentDocId();
        if (imgMgr?.getBlobUrl && docId) url = (await imgMgr.getBlobUrl(docId, src)) || src;
      }
      all.push(url);
      index = all.length - 1;
    }
    previewImg.value = { images: all, index };
  }
  /** 双击图片 → 灯箱（单击保留给选中/操作条；交互与官方一致） */
  async function onEditorDblClick(e: MouseEvent) {
    const t = e.target as HTMLElement;
    const block = t.closest(".milkdown-image-block, .milkdown-image") as HTMLElement | null;
    if (!block) return;
    const img = block.querySelector("img");
    await openLightbox(img?.getAttribute("src") || "");
  }
  /** NodeView 操作条「查看大图」按钮 → 自定义事件 → 灯箱 */
  function installImagePreviewEvents() {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ src: string }>).detail;
      if (detail?.src) void openLightbox(detail.src);
    };
    window.addEventListener("milkdown:image-preview", handler);
    return () => window.removeEventListener("milkdown:image-preview", handler);
  }

  /** 打开文档：flush 源码 → 设当前 → 查名 → 挂载编辑器 → 手动刷大纲/字数 */
  async function openDoc(docId: string) {
    if (!boot.value) return;
    flushSourceBeforeSwitch();
    activeDocId.value = docId;
    activeId.value = docId;
    const node = await boot.value.storage.getNode(docId);
    docName.value = node?.name ?? "未命名文档";
    const a = await boot.value.openDocument(docId);
    if (a) {
      statusText.value = `已打开：${docName.value}`;
      const doc = await boot.value.storage.getDocContent(docId);
      onDocChanged(doc?.content ?? "");
    }
  }

  return {
    editorRoot,
    docTitle,
    outline,
    sidebarTab,
    docStats,
    statsText,
    lastMarkdown,
    sourceMode,
    sourceText,
    previewImg,
    focusEditor,
    onToolbar,
    onDocChanged,
    toggleSourceMode,
    flushSourceBeforeSwitch,
    rebuildEditor,
    onEditorDblClick,
    installImagePreviewEvents,
    openDoc,
  };
}
