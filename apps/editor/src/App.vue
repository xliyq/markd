<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, shallowRef, nextTick, computed } from "vue";
import { bootstrapApp } from "./bootstrap";
import type { AppBootstrap } from "./bootstrap";
import FileTree from "./components/FileTree.vue";
import InputDialog from "./components/InputDialog.vue";
import type { DocNode } from "@editor/shared";
import { parseOutline, countStats } from "@editor/plugins-app";
import { getFindReplace, runToolbarAction, setTextPrompt, setLinkPrompt, setImagePrompt } from "@editor/plugins-editor";
import TitleBar from "./components/TitleBar.vue";
import StatusBar from "./components/StatusBar.vue";
import EditorToolbar from "./components/EditorToolbar.vue";
import SettingsCenter from "./components/SettingsCenter.vue";
import LinkDialog from "./components/LinkDialog.vue";
import ImageDialog from "./components/ImageDialog.vue";
import FindPanel from "./components/FindPanel.vue";
import SearchPanel from "./components/SearchPanel.vue";
import OutlinePanel from "./components/OutlinePanel.vue";
import WelcomeOverlay from "./components/WelcomeOverlay.vue";
import type { OutlineItem, DocStats } from "@editor/plugins-app";
import {
  NConfigProvider,
  NModal,
  NRadioGroup,
  NRadioButton,
  NSwitch,
  NButton,
  NInput,
  NMenu,
  NSelect,
  NDropdown,
  darkTheme,
  type GlobalThemeOverrides,
} from "naive-ui";

const editorRoot = ref<HTMLElement>();
const boot = shallowRef<AppBootstrap | null>(null);
const statusText = ref("初始化…");
const activeDocId = ref<string | null>(null);
const treeModule = ref<Record<string, unknown> | null>(null);
const fileInput = ref<HTMLInputElement>();
const treeRef = ref<InstanceType<typeof FileTree> | null>(null);
/** 多标签冲突提示（doc:conflict 事件触发） */
const conflictMsg = ref<string | null>(null);
let conflictTimer: ReturnType<typeof setTimeout> | null = null;
/** 代码块复制成功提示 */
const copyToast = ref<boolean>(false);
let copyToastTimer: ReturnType<typeof setTimeout> | null = null;
const onCodeCopied = () => {
  copyToast.value = true;
  if (copyToastTimer) clearTimeout(copyToastTimer);
  copyToastTimer = setTimeout(() => (copyToast.value = false), 1500);
};
/** 链接复制成功提示（link-tooltip onCopyLink 事件） */
const onLinkCopied = (e: Event) => {
  const link = (e as CustomEvent<{ link: string }>).detail?.link ?? "";
  statusText.value = `链接已复制：${link}`;
  copyToast.value = true;
  if (copyToastTimer) clearTimeout(copyToastTimer);
  copyToastTimer = setTimeout(() => (copyToast.value = false), 1500);
};

const activeId = ref<string | null>(null);
/** 当前文档的显示名（从 storage 查，UUID 不可读） */
const docName = ref("未命名文档");
const docTitle = computed(() => docName.value);

/** 大纲（doc:changed 事件实时更新） */
const outline = ref<OutlineItem[]>([]);
/** 侧边栏页签（文档树 / 大纲） */
const sidebarTab = ref<"docs" | "outline">("docs");

/** 通用文本输入对话框（链接/图片 URL；替代 window.prompt） */
const promptDialog = ref<{ title: string; placeholder: string; initialValue: string; confirmText: string } | null>(null);
const promptResolve = ref<((v: string | null) => void) | null>(null);
function onPromptConfirm(value: string) {
  const r = promptResolve.value;
  promptDialog.value = null;
  r?.(value);
}
function onPromptCancel() {
  const r = promptResolve.value;
  promptDialog.value = null;
  r?.(null);
}

/** 双输入链接对话框（文案 + 地址） */
const linkDialog = ref<{ title: string; textLabel: string; urlLabel: string; confirmText: string } | null>(null);
const linkForm = ref({ text: "", url: "" });
const linkResolve = ref<((v: { text: string; href: string } | null) => void) | null>(null);
function onLinkConfirm(payload: { text: string; url: string }) {
  const r = linkResolve.value;
  linkDialog.value = null;
  r?.({ text: payload.text, href: payload.url });
}
function onLinkCancel() {
  const r = linkResolve.value;
  linkDialog.value = null;
  r?.(null);
}

/** 插入图片弹窗（URL 或本地文件上传，M4.1） */
const imageDialog = ref<{ title: string; confirmText: string } | null>(null);
const imageForm = ref({ src: "" });
const imageResolve = ref<((v: { src: string } | null) => void) | null>(null);
async function onImageFilePicked(file: File) {
  if (!file) return;
  const imgMgr = boot.value?.api.imageManager as
    | { saveImageFile?: (docId: string, f: File) => Promise<string> }
    | undefined;
  const docId = boot.value?.getCurrentDocId();
  if (!imgMgr?.saveImageFile || !docId) {
    statusText.value = "请先新建文档，再上传图片";
    return;
  }
  try {
    const rel = await imgMgr.saveImageFile(docId, file);
    imageForm.value.src = rel;
    statusText.value = `图片已上传：${rel}`;
  } catch (e) {
    statusText.value = `上传失败：${e instanceof Error ? e.message : String(e)}`;
  }
}
function onImageConfirm() {
  const r = imageResolve.value;
  imageDialog.value = null;
  r?.({ src: imageForm.value.src.trim() });
}
function onImageCancel() {
  const r = imageResolve.value;
  imageDialog.value = null;
  r?.(null);
}

/** 顶部工具栏动作（focus 编辑器后执行） */
/** 工具栏按钮点击后焦点会被 naive n-button 抢走，命令前后主动还给编辑器（等价旧 etb-btn 焦点不动） */
function focusEditor() {
  editorRoot.value?.querySelector<HTMLElement>(".ProseMirror")?.focus();
}
async function onToolbar(action: import("@editor/plugins-editor").ToolbarAction) {
  focusEditor();
  await runToolbarAction(action);
  focusEditor();
}
/** 字数统计 */
const docStats = ref<DocStats>({
  chars: 0, cjkChars: 0, words: 0, lines: 0, headings: 0,
});
const statsText = computed(() => {
  const s = docStats.value;
  return `${s.chars} 字符 · ${s.cjkChars} 中文 · ${s.words} 词 · ${s.headings} 标题`;
});

/** 订阅文档变更 → 更新大纲 + 字数 */
function onDocChanged(markdown: string) {
  outline.value = parseOutline(markdown);
  docStats.value = countStats(markdown);
  lastMarkdown.value = markdown;
}

/** 最近一次编辑器 Markdown（重建编辑器/切换插件即时生效用） */
const lastMarkdown = ref("");

/** 源码编辑模式（WYSIWYG ↔ Markdown 源码切换） */
const sourceMode = ref(false);
const sourceText = ref("");
/** 切换源码/可视化模式 */
function toggleSourceMode() {
  if (!boot.value) return;
  const inst = boot.value.editor;
  if (!sourceMode.value) {
    // 进入源码：取当前编辑器 Markdown 原文
    sourceText.value = inst?.getMarkdown() ?? lastMarkdown.value;
    sourceMode.value = true;
    statusText.value = "源码编辑模式（切回可视化后自动应用并保存）";
  } else {
    // 退出源码：整体替换文档内容（parser 解析 → dispatch → 触发 onChange → 自动保存）
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

/** 字体档位（语义化）→ 基准字号(px) 映射；'medium' 默认对齐 crepe 16px */
type FontSize = "small" | "medium" | "large" | "xlarge";
const FONT_SIZE_MAP: Record<FontSize, number> = { small: 14, medium: 16, large: 18, xlarge: 20 };
const FONT_SIZE_OPTIONS: FontSize[] = ["small", "medium", "large", "xlarge"];
/** 旧版数字 px 值 → 档位（兼容历史保存） */
function legacyFontToSize(n: number): FontSize {
  if (n <= 14) return "small";
  if (n <= 16) return "medium";
  if (n <= 18) return "large";
  return "xlarge";
}

/** 编辑区偏好：字体档位（区块映射见 CSS：正文=基准，标题=em 官方倍数，代码块=0.875×）+ 最大宽度（'full'=铺满） */
const editorPrefs = ref<{ fontSize: FontSize; maxWidth: string }>({ fontSize: "medium", maxWidth: "860" });
const fontOptions = [
  { label: "小 · 14px", value: "small" },
  { label: "常规 · 16px", value: "medium" },
  { label: "大 · 18px", value: "large" },
  { label: "超大 · 20px", value: "xlarge" },
];
const widthOptions = [
  { label: "窄 · 720px", value: "720" },
  { label: "标准 · 860px", value: "860" },
  { label: "宽 · 1000px", value: "1000" },
  { label: "全屏 · 铺满编辑区", value: "full" },
];
function applyEditorPrefs() {
  const root = editorRoot.value;
  if (!root) return;
  // 档位 → 基准 px（区块按比例映射在 CSS 里：标题 em / 代码块 0.875×）
  root.style.setProperty("--editor-font-size", `${FONT_SIZE_MAP[editorPrefs.value.fontSize] ?? 16}px`);
  // 'full' → 100%（铺满编辑区）+ 左 padding 96px 为块句柄（六点 grip+加号 ≈66px）预留；
  // min(档位, 100%) 保证小屏自动收缩、永不水平溢出
  root.style.setProperty(
    "--editor-max-width",
    editorPrefs.value.maxWidth === "full" ? "100%" : `${editorPrefs.value.maxWidth}px`,
  );
  root.style.setProperty("--editor-pad-left", editorPrefs.value.maxWidth === "full" ? "96px" : "32px");
}
async function loadEditorPrefs() {
  const st = boot.value?.storage as { getSetting?: (k: string) => Promise<unknown> } | undefined;
  if (!st?.getSetting) return;
  const saved = (await st.getSetting("editor.prefs")) as { fontSize?: number | string; maxWidth?: number | string } | undefined;
  if (saved) {
    // 字体：旧数字 px → 档位；新档位字符串直接校验
    const fsRaw = saved.fontSize;
    const fs: FontSize =
      typeof fsRaw === "number"
        ? legacyFontToSize(fsRaw)
        : fsRaw && FONT_SIZE_OPTIONS.includes(fsRaw as FontSize)
          ? (fsRaw as FontSize)
          : "medium";
    // 宽度：兼容旧数字（1200 → 全屏 full）
    const rawW = saved.maxWidth;
    const w = rawW == null ? "860" : String(rawW) === "1200" ? "full" : String(rawW);
    const valid = ["720", "860", "1000", "full"].includes(w) ? w : "860";
    editorPrefs.value = { fontSize: fs, maxWidth: valid };
  }
  applyEditorPrefs();
}
async function saveEditorPrefs() {
  applyEditorPrefs(); // 先应用（UI 即时反馈，不依赖保存成功）
  const st = boot.value?.storage as { setSetting?: (k: string, v: unknown) => Promise<unknown> } | undefined;
  try {
    // 传 plain 对象：Vue reactive proxy 无法被 Dexie 结构化克隆（DataCloneError）
    await st?.setSetting?.("editor.prefs", { ...editorPrefs.value });
  } catch (e) {
    console.warn("编辑区偏好保存失败", e);
  }
}
async function setFontSize(v: string | number) {
  const s = String(v);
  if (FONT_SIZE_OPTIONS.includes(s as FontSize)) {
    editorPrefs.value.fontSize = s as FontSize;
    await saveEditorPrefs();
  }
}
async function setMaxWidth(v: string | number) {
  editorPrefs.value.maxWidth = String(v);
  await saveEditorPrefs();
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

/** 图片预览（点击编辑器内图片 → 大图弹层） */
const previewImg = ref<{ url: string } | null>(null);
async function onEditorClick(e: MouseEvent) {
  const t = e.target as HTMLElement;
  // 图片块整体可点（含未加载完成的 img）；排除操作按钮/输入框/缩放手柄
  if (t.closest(".operation-item, input, .image-resize-handle")) return;
  const block = t.closest(".milkdown-image-block, .milkdown-image") as HTMLElement | null;
  if (!block) return;
  const img = block.querySelector("img");
  const src = img?.getAttribute("src") || "";
  if (!src) return;
  // assets 相对路径 → blob URL（AssetResolver；外部 URL/图床直通）
  let url = src;
  if (src.startsWith("assets/")) {
    const imgMgr = boot.value?.api.imageManager as
      | { getBlobUrl?: (docId: string, relPath: string) => Promise<string> }
      | undefined;
    const docId = boot.value?.getCurrentDocId();
    if (imgMgr?.getBlobUrl && docId) url = (await imgMgr.getBlobUrl(docId, src)) || src;
  }
  previewImg.value = { url };
}

/** 主题模式（从 api.theme 模块读取） */
const themeMode = ref<"light" | "dark" | "system">("system");
const themeLabel = computed(() =>
  themeMode.value === "system" ? "🌓" : themeMode.value === "dark" ? "🌙" : "☀️"
);
async function setTheme(m: "light" | "dark" | "system") {
  const t = boot.value?.api.theme as { setMode: (m: string) => Promise<void> } | undefined;
  if (!t) return;
  await t.setMode(m);
  themeMode.value = m;
}
async function toggleTheme() {
  const t = boot.value?.api.theme as { setMode: (m: string) => Promise<void>; getMode: () => string } | undefined;
  if (!t) return;
  const cycle: Record<string, string> = { system: "light", light: "dark", dark: "system" };
  const next = cycle[t.getMode()] ?? "light";
  await t.setMode(next as never);
  themeMode.value = next as never;
}
/**
 * 实际生效的暗色（跟随 html[data-theme]，由 theme 模块 apply/watchSystem 驱动）。
 * 不依赖 themeMode：system 模式下 themeMode 恒为 "system"，且 theme.init 是异步的，
 * 首次求值若早于 data-theme 应用会停在亮色 token —— 用 MutationObserver 保证任何时序都跟随。
 */
const resolvedDark = ref(false);
let themeObserver: MutationObserver | null = null;
function syncResolvedDark() {
  resolvedDark.value = document.documentElement.getAttribute("data-theme") === "dark";
}
syncResolvedDark();
const naiveTheme = computed(() => (resolvedDark.value ? darkTheme : null));
/** Naive UI 主题覆盖：从 data-theme 的 CSS 变量派生，跟随应用主题 */
const naiveOverrides = computed<GlobalThemeOverrides>(() => {
  void resolvedDark.value; // 响应式依赖：data-theme 变化（含 system 初始/系统切换）后重算（DOM 计算样式非响应式）
  const s = getComputedStyle(document.documentElement);
  const v = (name: string) => s.getPropertyValue(name).trim() || undefined;
  return {
    common: {
      primaryColor: v("--accent"),
      primaryColorHover: v("--accent"),
      primaryColorPressed: v("--accent"),
      primaryColorSuppl: v("--accent"),
      // 背景系：卡/弹层/输入框对齐应用 token（dark 下跟随 data-theme，而非 naive 自带深灰）
      bodyColor: v("--bg"),
      cardColor: v("--bg"),
      modalColor: v("--bg"),
      popoverColor: v("--bg-soft"),
      tooltipColor: v("--bg"),
      inputColor: v("--bg-soft"),
      inputColorDisabled: v("--bg-soft"),
      inputTextColor: v("--text"),
      // 文字系
      textColorBase: v("--text"),
      textColor1: v("--text"),
      textColor2: v("--text"),
      textColor3: v("--text-muted"),
      textColorDisabled: v("--text-muted"),
      // 边框 / 分隔
      borderColor: v("--border"),
      borderColorStrong: v("--border"),
      dividerColor: v("--border-soft"),
      borderRadius: "6px",
    },
  };
});
/** Naive radio-group 回调 → 主题持久化 */
function onThemeModeChange(m: string | number) {
  void setTheme(m as "light" | "dark" | "system");
}

/** 设置面板开关 */
const showSettings = ref(false);
/** 设置中心页签（左侧导航，右侧内容切换；保留各面板状态） */
const settingsTab = ref("general");
const settingsTabs = [
  { label: "🛠 通用", key: "general" },
  { label: "📝 编辑区", key: "editor" },
  { label: "🧩 插件", key: "plugins" },
  { label: "💾 数据", key: "data" },
];
/** 恢复备份的文件选择器 */
/** 侧边栏收起/展开（替代原 聚焦/无干扰 三态模式） */
const sidebarCollapsed = ref(false);
/** 查找/替换面板 */
const findOpen = ref(false);

/** 全文搜索面板（ADR-016 / Phase 5） */
const searchOpen = ref(false);
const searchQuery = ref("");
const searchResults = ref<{ id: string; name: string; snippet: string; score: number }[]>([]);
const searchTotal = ref(0);

function getSearchMod() {
  type SM = {
    search: (q: string, topN?: number) => { id: string; name: string; snippet: string; score: number }[];
  };
  return (boot.value?.api.search as SM | undefined) ?? null;
}
function onSearchInput() {
  const mod = getSearchMod();
  if (!mod) return;
  const q = searchQuery.value;
  if (!q.trim()) {
    searchResults.value = [];
    searchTotal.value = 0;
    return;
  }
  searchResults.value = mod.search(q, 30);
  searchTotal.value = searchResults.value.length;
}
function openSearchResult(docId: string) {
  searchOpen.value = false;
  void openDoc(docId);
}
function closeSearch() {
  searchOpen.value = false;
  searchQuery.value = "";
  searchResults.value = [];
}
const findQuery = ref("");
const findReplacement = ref("");
const findTotal = ref(0);
const findCurrent = ref(0);

function getFindCtrl() {
  // find-replace 插件模块级注册的 controller（编辑器创建时激活）
  return getFindReplace();
}

function openFind() {
  findOpen.value = true;
  // 输入框聚焦由 v-focus 指令处理
}
function onFindInput() {
  const ctrl = getFindCtrl();
  if (!ctrl) return;
  const n = ctrl.find(findQuery.value);
  findTotal.value = n;
  findCurrent.value = n > 0 ? 1 : 0;
}
function onFindNext() {
  const ctrl = getFindCtrl();
  if (!ctrl) return;
  ctrl.next();
  findCurrent.value = findTotal.value > 0 ? (findCurrent.value % findTotal.value) + 1 : 0;
}
function onFindPrev() {
  const ctrl = getFindCtrl();
  if (!ctrl) return;
  ctrl.prev();
  findCurrent.value = findTotal.value > 0 ? ((findCurrent.value - 2 + findTotal.value) % findTotal.value) + 1 : 0;
}
function onReplaceOne() {
  const ctrl = getFindCtrl();
  if (!ctrl) return;
  if (ctrl.replaceCurrent(findReplacement.value)) onFindInput();
}
function onReplaceAll() {
  const ctrl = getFindCtrl();
  if (!ctrl) return;
  const n = ctrl.replaceAll(findReplacement.value);
  findTotal.value = 0;
  findCurrent.value = 0;
  statusText.value = `已替换 ${n} 处`;
}
function closeFind() {
  findOpen.value = false;
  getFindCtrl()?.clear();
}
/** n-input 触发：写回 query 后再执行（避免依赖 v-model/update 同名事件执行序） */
function onFindQueryInput(v: string) {
  findQuery.value = v;
  onFindInput();
}
function onSearchQueryInput(v: string) {
  searchQuery.value = v;
  onSearchInput();
}
/** 插件开关状态（PluginManager 启停） */
const pluginSwitches = ref<{ id: string; name: string; enabled: boolean }[]>([]);
function loadPluginSwitches() {
  const pm = boot.value?.pm;
  if (!pm) return;
  const manifests = (pm as unknown as { registry: Map<string, { name: string }> }).registry;
  pluginSwitches.value = [...manifests.entries()].map(([id, m]) => ({
    id,
    name: m.name ?? id,
    enabled: pm.isEnabled(id),
  }));
}
async function togglePlugin(id: string) {
  const b = boot.value;
  const pm = b?.pm as unknown as {
    setEnabled: (id: string, e: boolean) => void;
    registry: Map<string, { type: string }>;
  } | undefined;
  const cur = pluginSwitches.value.find((p) => p.id === id);
  if (!pm || !cur) return;
  const next = !cur.enabled;
  pm.setEnabled(id, next);
  cur.enabled = next;
  // 持久化启停覆盖 + 重算装配（L1 新列表 + L2 差异挂载/卸载）
  b?.persistPluginOverrides();
  await b?.rebuildPlugins();
  // L1 插件（编辑器内）→ 重建编辑器即时生效；L2 已由 remountEnabled 差异处理
  const manifest = pm.registry.get(id);
  if (manifest?.type === "milkdown") {
    await rebuildEditor();
  }
  statusText.value = `插件「${cur.name}」已${next ? "启用" : "停用"}（立即生效）`;
}

/** M7.2 数据备份：导出全量 JSON */
async function onBackup() {
  const b = boot.value?.api.backup as { exportBackup: () => Promise<{ json: string; name: string }> } | undefined;
  if (!b) return;
  try {
    const { json, name } = await b.exportBackup();
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    statusText.value = `已导出备份 ${name}`;
  } catch (e) {
    statusText.value = `备份失败: ${e instanceof Error ? e.message : String(e)}`;
  }
}

/** M7.2 数据恢复：导入备份 JSON */
async function onRestoreFile(file: File) {
  const b = boot.value?.api.backup as { importBackup: (json: string) => Promise<{ docs: number }> } | undefined;
  if (!b || !file) return;
  try {
    statusText.value = "恢复中…";
    file.text().then(async (json) => {
      const stat = await b.importBackup(json);
      statusText.value = `已恢复 ${stat.docs} 篇文档（刷新后生效）`;
      await treeRef.value?.refresh();
    });
  } catch (e) {
    statusText.value = `恢复失败: ${e instanceof Error ? e.message : String(e)}`;
  }
}

async function openDoc(docId: string) {
  if (!boot.value) return;
  flushSourceBeforeSwitch();
  activeDocId.value = docId;
  activeId.value = docId;
  // 查节点名（UUID 不可展示）
  const node = await boot.value.storage.getNode(docId);
  docName.value = node?.name ?? "未命名文档";
  const a = await boot.value.openDocument(docId);
  if (a) {
    statusText.value = `已打开：${docName.value}`;
    // 加载内容后手动刷新大纲/字数（openDocument 不触发 doc:changed）
    const doc = await boot.value.storage.getDocContent(docId);
    onDocChanged(doc?.content ?? "");
  }
}

async function onTreeChanged() {
  statusText.value = "文档树已更新";
}

/** 打开设置面板时刷新插件开关 */
function onOpenSettings() {
  showSettings.value = true;
  loadPluginSwitches();
}

/** 导入 .md：唤起文件选择 → import 模块落库 → 刷新树并打开 */
async function onImport() {
  const input = fileInput.value;
  if (!input) return;
  const file = input.files?.[0];
  if (!file) return;
  const mod = boot.value?.api.import as
    | { importMd: (f: File, parentId?: string | null) => Promise<{ docId: string; name: string }> }
    | undefined;
  if (!mod) return;
  try {
    statusText.value = `导入中：${file.name}…`;
    const result = await mod.importMd(file);
    await treeRef.value?.refresh();
    await openDoc(result.docId);
    statusText.value = `已导入：${result.name}`;
  } catch (e) {
    statusText.value = `导入失败: ${e instanceof Error ? e.message : String(e)}`;
  } finally {
    input.value = "";
  }
}

/** 导出当前文档为 zip */
/** 导出下拉选项（zip/HTML，PDF/Word 后期占位） */
const exportOptions = [
  { label: "Markdown 打包（zip + 图片）", key: "zip" },
  { label: "HTML 页面", key: "html" },
  { label: "PDF（打印另存）", key: "pdf" },
  { label: "Word 文档（.doc）", key: "word" },
];
function onExportSelect(key: string) {
  if (key === "zip") void onExport();
  else if (key === "html") void onExportHtml();
  else if (key === "pdf") void onExportPdf();
  else if (key === "word") void onExportWord();
}

async function onExport() {
  const mod = boot.value?.api.export as
    | { exportDoc: (docId: string) => Promise<number> }
    | undefined;
  if (!mod) return;
  if (!activeDocId.value) {
    statusText.value = "没有打开的文档";
    return;
  }
  try {
    const n = await mod.exportDoc(activeDocId.value);
    statusText.value = `已导出（含 ${n} 个本地资源）`;
  } catch (e) {
    statusText.value = `导出失败: ${e instanceof Error ? e.message : String(e)}`;
  }
}

/** 导出当前文档为独立 HTML（M3.2） */
async function onExportHtml() {
  const mod = boot.value?.api.export as
    | { exportHtml: (docId: string) => Promise<string> }
    | undefined;
  if (!mod) return;
  if (!activeDocId.value) {
    statusText.value = "没有打开的文档";
    return;
  }
  try {
    const html = await mod.exportHtml(activeDocId.value);
    // 下载 .html 文件
    const node = (boot.value?.api.documentTree as never) as
      | { list: (p: string | null) => Promise<{ id: string; name: string }[]> }
      | undefined;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "document.html";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    statusText.value = "已导出 HTML";
  } catch (e) {
    statusText.value = `导出失败: ${e instanceof Error ? e.message : String(e)}`;
  }
}

/** 导出 PDF：完整 HTML 渲染进隐藏 iframe → window.print()（浏览器"另存为 PDF"） */
async function onExportPdf() {
  const mod = boot.value?.api.export as { exportHtml: (docId: string) => Promise<string> } | undefined;
  if (!mod || !activeDocId.value) {
    statusText.value = "没有打开的文档";
    return;
  }
  try {
    const html = await mod.exportHtml(activeDocId.value);
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    if (!doc) { iframe.remove(); throw new Error("iframe 不可用"); }
    doc.open();
    doc.write(html);
    doc.close();
    // 等样式/图片就绪后触发打印（print 阻塞至对话框关闭）
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => iframe.remove(), 500);
    }, 400);
    statusText.value = "已打开打印对话框，请选择「另存为 PDF」";
  } catch (e) {
    statusText.value = `导出失败: ${e instanceof Error ? e.message : String(e)}`;
  }
}

/** 导出 Word：完整 HTML 包装为 Word HTML（.doc，Word/WPS 可直接打开编辑） */
async function onExportWord() {
  const mod = boot.value?.api.export as { exportHtml: (docId: string) => Promise<string> } | undefined;
  if (!mod || !activeDocId.value) {
    statusText.value = "没有打开的文档";
    return;
  }
  try {
    const html = await mod.exportHtml(activeDocId.value);
    const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
    const title = html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "document";
    const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>
body { font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; line-height: 1.7; color: #2c2c2c; }
h1, h2, h3, h4 { margin-top: 1.4em; margin-bottom: 0.5em; }
code { background: #f4f4f5; font-family: Consolas, monospace; }
pre { background: #f4f4f5; padding: 12px; }
blockquote { border-left: 4px solid #ccc; margin: 0; padding: 2px 14px; color: #666; }
table { border-collapse: collapse; }
th, td { border: 1px solid #ccc; padding: 6px 10px; }
img { max-width: 100%; }
</style>
</head>
<body>${body}</body>
</html>`;
    const blob = new Blob([wordHtml], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    statusText.value = "已导出 Word 文档";
  } catch (e) {
    statusText.value = `导出失败: ${e instanceof Error ? e.message : String(e)}`;
  }
}

/** 首次启动欢迎引导（M1.12） */
const showWelcome = ref(false);

/** 空库引导（用户删光全部文档） */
const showEmptyHint = ref(false);

/** 隐藏欢迎面板并记录已看过 */
async function dismissWelcome() {
  showWelcome.value = false;
  await boot.value?.storage.setSetting("first-run.v1", true);
}

/** 从欢迎面板新建文档（自绘对话框） */
const createDocDialog = ref(false);
async function welcomeCreateDoc() {
  createDocDialog.value = true;
}
async function onCreateDocConfirm(name: string) {
  createDocDialog.value = false;
  const v = name.trim();
  if (!v || !boot.value) return;
  const dt = boot.value.api.documentTree as {
    create: (name: string) => Promise<{ id: string }>;
  };
  const node = await dt.create(v);
  await treeRef.value?.refresh();
  await openDoc(node.id);
  await dismissWelcome();
  showEmptyHint.value = false;
}

/** 从欢迎面板快速记录（带时间戳名） */
async function welcomeQuickNote() {
  if (!boot.value) return;
  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const dt = boot.value.api.documentTree as {
    create: (name: string) => Promise<{ id: string }>;
  };
  const node = await dt.create(`速记 ${stamp}`);
  await treeRef.value?.refresh();
  await openDoc(node.id);
  await dismissWelcome();
  showEmptyHint.value = false;
}

/** 检查文档库是否为空（根节点无未删除文档且无文件夹） */
async function checkEmptyLibrary(): Promise<boolean> {
  if (!boot.value) return false;
  const dt = boot.value.api.documentTree as { list: (p: string | null) => Promise<unknown[]> };
  const roots = await dt.list(null);
  return roots.length === 0;
}

onMounted(async () => {
  // Naive 主题跟随 html[data-theme]（theme 模块异步 init 完成后才 apply，observer 捕获任何时机）
  syncResolvedDark();
  themeObserver = new MutationObserver(syncResolvedDark);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  try {
    boot.value = await bootstrapApp();
    statusText.value = "就绪";
    const dt = boot.value.api.documentTree as Record<string, unknown> | undefined;
    treeModule.value = dt ?? null;
    // 订阅文档变更 → 大纲/字数实时更新
    boot.value.pm.on('doc:changed', (payload) => {
      const p = payload as { docId: string; markdown: string };
      onDocChanged(p.markdown);
    });
    // 主题初始状态
    const t = boot.value.api.theme as { init: () => Promise<void>; getMode: () => string } | undefined;
    if (t) {
      // theme.init 是异步的（mount 时 void 触发），await 同一次 promise 后再读，避免拿到初始 'light'
      await t.init();
      themeMode.value = t.getMode() as never;
    }

    // 注册文本输入桥（链接/图片 URL → 自绘 InputDialog，替代 window.prompt）
    setImagePrompt((opts) => {
      imageForm.value = { src: "" };
      imageDialog.value = { title: opts.title, confirmText: opts.confirmText || "插入" };
      return new Promise((resolve) => {
        imageResolve.value = resolve;
      });
    });
    setLinkPrompt((opts) => {
      // 选中文本预填「显示文案」
      const selText = window.getSelection()?.toString() ?? "";
      linkForm.value = { text: opts.initialText || selText, url: "" };
      linkDialog.value = {
        title: opts.title,
        textLabel: opts.textLabel,
        urlLabel: opts.urlLabel,
        confirmText: opts.confirmText || "确定",
      };
      return new Promise((resolve) => {
        linkResolve.value = resolve;
      });
    });
    setTextPrompt((opts) => {
      promptDialog.value = {
        title: opts.title,
        placeholder: opts.placeholder ?? '',
        initialValue: opts.initialValue ?? '',
        confirmText: opts.confirmText ?? '确定',
      }
      return new Promise((resolve) => {
        promptResolve.value = resolve
      })
    });

    // ── M1.12 首启引导 + 空库引导 ──
    const firstRun = await boot.value.storage.getSetting("first-run.v1");
    const emptyLib = await checkEmptyLibrary();
    if (!firstRun) {
      // 首次启动：欢迎面板（无论是否有文档，给新用户一个入口）
      showWelcome.value = true;
    } else if (emptyLib) {
      // 非首次但库为空（删光了）：显示空状态提示
      showEmptyHint.value = true;
    }

    // Ctrl+F 唤起查找（挂在 window，避免编辑器焦点丢失）
    globalFindHandler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        openFind();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchOpen.value = true;
        searchQuery.value = "";
        searchResults.value = [];
        void onSearchInput();
      }
      if (e.key === 'Escape' && findOpen.value) {
        closeFind();
      }
    };
    window.addEventListener('keydown', globalFindHandler);
    // 订阅多标签冲突事件（其他标签保存了当前文档）
    boot.value.pm.on('doc:conflict', (payload) => {
      const p = payload as { docId: string; contentHash: string; at: number };
      conflictMsg.value = `⚠️ 检测到其他标签页也编辑了本文档（${new Date(p.at).toLocaleTimeString()}）——当前内容可能被覆盖`;
      if (conflictTimer) clearTimeout(conflictTimer);
      conflictTimer = setTimeout(() => (conflictMsg.value = null), 6000);
    });

    // 代码块复制成功 → toast
    window.addEventListener('milkdown:code-copied', onCodeCopied);
  window.addEventListener('milkdown:link-copied', onLinkCopied);
  } catch (e) {
    statusText.value = `启动失败: ${e instanceof Error ? e.message : String(e)}`;
    console.error(e);
    return;
  }

  // 初始示例文档
  await nextTick();
  if (editorRoot.value && boot.value) {
    const md = `# 示例文档

这是 **WYSIWYG** Markdown 编辑器。

## 功能

- 插件化架构（PluginManager 装配）
- 本地优先（IndexedDB 存储）
- 表格、图片、任务列表等 GFM 语法

| 列 A | 列 B |
| ---- | ---- |
| 1    | 2    |
`;
    await boot.value.mountEditor(editorRoot.value, md);
    // 示例文档无 docId → doc:changed 不触发 → 手动填充一次大纲/字数
    onDocChanged(md);
    await loadEditorPrefs();
    statusText.value = "编辑器已就绪";
  }
});

let globalFindHandler: ((e: KeyboardEvent) => void) | null = null;

onBeforeUnmount(() => {
  themeObserver?.disconnect();
  if (globalFindHandler) window.removeEventListener('keydown', globalFindHandler);
  window.removeEventListener('milkdown:code-copied', onCodeCopied);
  window.removeEventListener('milkdown:link-copied', onLinkCopied);
  if (copyToastTimer) clearTimeout(copyToastTimer);
  boot.value?.unmountEditor();
  boot.value?.dispose();
});
</script>

<template>
  <n-config-provider
    style="display:flex; flex-direction:column; height:100vh"
    :theme="naiveTheme"
    :theme-overrides="naiveOverrides"
  >
  <div class="app-shell">
      <TitleBar
        :doc-name="docName"
        :theme-label="themeLabel"
        :export-options="exportOptions"
        @import="fileInput?.click()"
        @export="onExportSelect"
        @toggle-theme="toggleTheme"
        @open-settings="onOpenSettings"
      />
      <!-- 隐藏文件输入（导入 .md；TitleBar/Welcome 的 @import 触发） -->
      <input
        ref="fileInput"
        type="file"
        accept=".md,.markdown,text/markdown"
        style="display: none"
        @change="onImport"
      />

      <div v-if="conflictMsg" class="conflict-banner" role="alert">{{ conflictMsg }}</div>

      <!-- 代码块复制成功 toast -->
      <Transition name="copy-fade">
        <div v-if="copyToast" class="copy-toast" role="status">已复制到剪贴板</div>
      </Transition>

      <!-- 查找/替换面板 -->
      <FindPanel
        :open="findOpen"
        :query="findQuery"
        :replacement="findReplacement"
        :total="findTotal"
        :current="findCurrent"
        @close="closeFind"
        @query="onFindQueryInput"
        @next="onFindNext"
        @prev="onFindPrev"
        @replace="onReplaceOne"
        @replace-all="onReplaceAll"
      />

      <!-- 全文搜索面板 -->
      <SearchPanel
        :open="searchOpen"
        :query="searchQuery"
        :total="searchTotal"
        :results="searchResults"
        @close="closeSearch"
        @query="onSearchQueryInput"
        @open="openSearchResult"
      />

      <!-- 设置中心 -->
      <SettingsCenter
        :show="showSettings"
        :settings-tab="settingsTab"
        :settings-tabs="settingsTabs"
        :theme-mode="themeMode"
        :editor-prefs="editorPrefs"
        :font-options="fontOptions"
        :width-options="widthOptions"
        :plugin-switches="pluginSwitches"
        @update:show="(v: boolean) => (showSettings = v)"
        @update:settings-tab="(k: string) => (settingsTab = k)"
        @theme-mode-change="onThemeModeChange"
        @font-size="setFontSize"
        @max-width="setMaxWidth"
        @toggle-plugin="togglePlugin"
        @backup="onBackup"
        @restore="onRestoreFile"
      />

      <!-- 首启欢迎 -->
      <WelcomeOverlay
        :show="showWelcome"
        @create="welcomeCreateDoc"
        @import="fileInput?.click()"
        @quick-note="welcomeQuickNote"
        @skip="dismissWelcome"
      />

    <!-- 空库提示（文档全部删除后） -->
    <div v-if="showEmptyHint" class="empty-hint" role="status">
      <span>📂 文档库为空</span>
      <button class="toolbar-btn" @click="welcomeCreateDoc">新建文档</button>
      <button class="toolbar-btn" @click="fileInput?.click()">导入 .md</button>
      <button class="toolbar-btn" @click="showEmptyHint = false">知道了</button>
    </div>

    <!-- 自绘新建文档对话框（欢迎面板/空库提示复用） -->
    <InputDialog
      :open="createDocDialog"
      title="新建文档"
      placeholder="文档名称"
      initial-value="未命名文档"
      confirm-text="创建"
      @confirm="onCreateDocConfirm"
      @cancel="createDocDialog = false"
    />

    <!-- 插入链接 -->
      <LinkDialog
        :show="!!linkDialog"
        :title="linkDialog?.title || '插入链接'"
        :text-label="linkDialog?.textLabel || '显示文案'"
        :url-label="linkDialog?.urlLabel || '链接地址'"
        :confirm-text="linkDialog?.confirmText || '确定'"
        :initial-text="linkForm.text"
        :initial-url="linkForm.url"
        @update:show="(v: boolean) => { if (!v) onLinkCancel() }"
        @confirm="onLinkConfirm"
      />

    <!-- 插入图片 -->
      <ImageDialog
        :show="!!imageDialog"
        :title="imageDialog?.title || '插入图片'"
        :confirm-text="imageDialog?.confirmText || '插入'"
        :src="imageForm.src"
        @update:show="(v: boolean) => { if (!v) onImageCancel() }"
        @update:src="(v: string) => (imageForm.src = v)"
        @upload="onImageFilePicked"
        @confirm="onImageConfirm"
      />

    <!-- 通用文本输入（链接/图片 URL；替代 window.prompt） -->
    <InputDialog
      :open="!!promptDialog"
      :title="promptDialog?.title || ''"
      :placeholder="promptDialog?.placeholder"
      :initial-value="promptDialog?.initialValue !== undefined ? promptDialog?.initialValue : undefined"
      :confirm-text="promptDialog?.confirmText || '确定'"
      @confirm="onPromptConfirm"
      @cancel="onPromptCancel"
    />

    <div class="layout">
        <!-- 侧边栏：文档树 / 大纲（页签切换） -->
        <!-- 侧边栏右边缘悬浮折叠按钮（六个点） -->
        <button
          class="sidebar-collapse-btn"
          :class="{ collapsed: sidebarCollapsed }"
          title="收起/展开侧边栏"
          :aria-pressed="sidebarCollapsed"
          @click="sidebarCollapsed = !sidebarCollapsed"
        >
          <svg width="10" height="18" viewBox="0 0 10 18" fill="currentColor" aria-hidden="true">
            <circle cx="3" cy="2.5" r="1.5"/><circle cx="7" cy="2.5" r="1.5"/>
            <circle cx="3" cy="9" r="1.5"/><circle cx="7" cy="9" r="1.5"/>
            <circle cx="3" cy="15.5" r="1.5"/><circle cx="7" cy="15.5" r="1.5"/>
          </svg>
        </button>
        <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }" role="complementary" aria-label="侧边栏">
          <div class="sidebar-tabs" role="tablist" aria-label="侧边栏面板">
            <button
              class="sidebar-tab"
              :class="{ active: sidebarTab === 'docs' }"
              role="tab"
              :aria-selected="sidebarTab === 'docs'"
              @click="sidebarTab = 'docs'"
            >文档</button>
            <button
              class="sidebar-tab"
              :class="{ active: sidebarTab === 'outline' }"
              role="tab"
              :aria-selected="sidebarTab === 'outline'"
              @click="sidebarTab = 'outline'"
            >大纲</button>
          </div>

          <!-- 文档树页签 -->
          <template v-if="sidebarTab === 'docs'">
            <FileTree
              v-if="treeModule"
              ref="treeRef"
              :tree="treeModule as never"
              :active-id="activeDocId"
              @open="openDoc"
              @changed="onTreeChanged"
            />
            <div v-else class="sidebar-empty">文档树初始化中…</div>
          </template>

          <!-- 大纲页签（P1.4） -->
          <OutlinePanel v-else :items="outline" @jump="(text: string) => boot?.editor?.scrollToHeading(text)" />
        </aside>

        <!-- 主编辑区 -->
        <main class="main" :class="{ 'source-mode': sourceMode }" role="main" aria-label="编辑区">
          <!-- 顶部编辑工具栏（替代依赖 slash/tooltip 才发现功能） -->
          <EditorToolbar :source-mode="sourceMode" @toolbar="onToolbar" @toggle-source="toggleSourceMode" />
          <div ref="editorRoot" v-show="!sourceMode" class="editor-root" @click="onEditorClick"></div>
          <textarea
            v-show="sourceMode"
            v-model="sourceText"
            class="source-editor"
            spellcheck="false"
            aria-label="Markdown 源码编辑"
            placeholder="# 在此编辑 Markdown 源码…"
          ></textarea>
        </main>
      </div>

      <StatusBar :status-text="statusText" :doc-stats-text="statsText" :source-mode="sourceMode" />
    </div>
      <!-- 图片预览大图（点击编辑器内图片触发） -->
      <div
        v-if="previewImg"
        class="image-preview-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="图片预览"
        @click="previewImg = null"
      >
        <img :src="previewImg.url" class="image-preview-img" alt="预览大图" @click.stop />
        <button class="image-preview-close" aria-label="关闭预览" @click="previewImg = null">✕</button>
      </div>
  </n-config-provider>
</template>

<style>
/* ── Token（P1.6 主题系统）── */
:root,
:root[data-theme="light"] {
  --bg: #ffffff;
  --bg-soft: #fafafa;
  --border: #e5e5e5;
  --border-soft: #eee;
  --text: #333333;
  --text-muted: #888888;
  --accent: #2563eb;
  --accent-soft: #f0f7ff;
  --btn-bg: #ffffff;
  --btn-border: #ddd;
  --warn-bg: #fff7ed;
  --warn-text: #c2410c;
  --warn-border: #fed7aa;
  --scrollbar-thumb: #c8c8cc;
  --scrollbar-thumb-hover: #a8a8ad;
}
:root[data-theme="dark"] {
  --bg: #1a1a1a;
  --bg-soft: #222222;
  --border: #3a3a3a;
  --border-soft: #333;
  --text: #e5e5e5;
  --text-muted: #9a9a9a;
  --accent: #60a5fa;
  --accent-soft: #1e3a5f;
  --btn-bg: #2b2b2b;
  --btn-border: #444;
  --warn-bg: #3a2a1a;
  --warn-text: #fbbf24;
  --warn-border: #5a3a1a;
  --scrollbar-thumb: #3f3f46;
  --scrollbar-thumb-hover: #52525b;
}

.app-shell { display: flex; flex-direction: column; height: 100vh; background: var(--bg); color: var(--text); }
.titlebar { display: flex; align-items: center; gap: 12px; padding: 8px 16px; border-bottom: 1px solid var(--border); background: var(--bg); font-size: 13px; }
.app-name { font-weight: 600; }
.doc-title { color: var(--text-muted); }
.spacer { flex: 1; }
.toolbar-btn { padding: 4px 10px; font-size: 12px; border: 1px solid var(--btn-border); border-radius: 4px; background: var(--btn-bg); color: var(--text); cursor: pointer; }
.toolbar-btn:hover { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
.layout { flex: 1; display: flex; min-height: 0; position: relative; }
/* 侧边栏折叠悬浮按钮（六个点，贴在侧边栏右边缘/窗口左缘） */
.sidebar-collapse-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  left: 240px;
  width: 18px;
  height: 42px;
  border: 1px solid var(--border);
  border-left: none;
  border-radius: 0 6px 6px 0;
  background: var(--bg-soft);
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  transition: left 0.15s ease;
  padding: 0;
}
.sidebar-collapse-btn.collapsed { left: 0; }
.sidebar-collapse-btn:hover { color: var(--accent); background: var(--accent-soft); }
.sidebar { width: 240px; border-right: 1px solid var(--border); background: var(--bg-soft); display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
.sidebar-header { padding: 10px 12px; border-bottom: 1px solid var(--border-soft); font-size: 13px; font-weight: 600; }
.sidebar-tabs { display: flex; border-bottom: 1px solid var(--border-soft); }
.sidebar-tab { flex: 1; padding: 9px 12px; font-size: 13px; font-weight: 500; border: none; background: transparent; color: var(--text-muted); cursor: pointer; border-bottom: 2px solid transparent; }
.sidebar-tab:hover { color: var(--text); }
.sidebar-tab.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }
.sidebar-empty { padding: 10px 12px; font-size: 12px; color: var(--text-muted); }
.main { flex: 1; overflow-y: auto; background: var(--bg); }
.main.source-mode { display: flex; flex-direction: column; }
.source-editor {
  flex: 1;
  width: 100%;
  min-height: 0;
  border: none;
  outline: none;
  resize: none;
  padding: 16px 24px 40px;
  background: var(--bg);
  color: var(--text);
  font-family: "Cascadia Code", Consolas, "Courier New", monospace;
  font-size: 14px;
  line-height: 1.7;
  tab-size: 2;
  box-sizing: border-box;
}
.source-editor:focus { box-shadow: inset 0 0 0 1px var(--border-soft); }
.editor-root { max-width: min(var(--editor-max-width, 860px), 100%); font-size: var(--editor-font-size, 15px); margin: 0 auto; padding: 24px 32px 120px; padding-left: var(--editor-pad-left, 32px); min-height: 100%; display: flex; flex-direction: column; }

/* ── 顶部编辑工具栏 ── */
.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-soft);
  position: sticky;
  top: 0;
  z-index: 50;
  flex-wrap: wrap;
}
.toolbar-group { display: flex; align-items: center; gap: 2px; }
.toolbar-sep { width: 1px; height: 20px; background: var(--border); }
.statusbar { display: flex; align-items: center; gap: 16px; padding: 4px 16px; border-top: 1px solid var(--border); background: var(--bg); font-size: 12px; color: var(--text-muted); }
.conflict-banner { padding: 8px 16px; background: var(--warn-bg); color: var(--warn-text); border-bottom: 1px solid var(--warn-border); font-size: 13px; }
/* 代码块复制成功 toast */
.copy-toast {
  position: fixed;
  top: 56px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  padding: 8px 18px;
  background: var(--bg-invert, rgba(0,0,0,0.85));
  color: #fff;
  border-radius: 6px;
  font-size: 13px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.25);
  pointer-events: none;
}
.copy-fade-enter-active, .copy-fade-leave-active { transition: opacity 0.2s, transform 0.2s; }
.copy-fade-enter-from, .copy-fade-leave-to { opacity: 0; transform: translateX(-50%) translateY(-6px); }
.outline-list { flex: 1; overflow-y: auto; padding: 6px 4px; }
.outline-item {
  display: block;
  width: 100%;
  padding: 5px 8px;
  border: none;
  background: transparent;
  text-align: left;
  font-size: 12px;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  border-radius: 4px;
}
.outline-item:hover { background: var(--accent-soft); color: var(--accent); }

/* ── 全局滚动条（主题化：跟随 --scrollbar-thumb token）── */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) transparent;
}
*::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
*::-webkit-scrollbar-track {
  background: transparent;
}
*::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 6px;
  border: 2px solid transparent;
  background-clip: content-box;
}
*::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
  background-clip: content-box;
}
*::-webkit-scrollbar-corner {
  background: transparent;
}
.welcome-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
}
.welcome-panel {
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 32px 40px;
  max-width: 420px;
  text-align: center;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
}
.welcome-title { font-size: 20px; font-weight: 700; margin-bottom: 12px; }
.welcome-desc { font-size: 13px; color: var(--text-muted); margin-bottom: 24px; line-height: 1.7; }
.welcome-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-bottom: 16px; }
.welcome-btn { padding: 8px 16px; font-size: 14px; }
.welcome-skip { font-size: 12px; color: var(--text-muted); background: none; border: none; cursor: pointer; }
.welcome-skip:hover { color: var(--accent); }
.empty-hint {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: var(--accent-soft);
  border-bottom: 1px solid var(--border-soft);
  font-size: 13px;
  color: var(--text);
}

.outline-panel { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow-y: auto; }
/* ── 移动端响应式（发布检查单 §8.1）── */
@media (max-width: 768px) {
  .layout { flex-direction: column; }
  .sidebar { width: 100%; max-height: 40vh; border-right: none; border-bottom: 1px solid var(--border); order: 2; }
  .main { order: 1; min-height: 50vh; }
  .titlebar { flex-wrap: wrap; gap: 6px; padding: 6px 10px; }
  .toolbar-btn { padding: 3px 8px; font-size: 12px; }
  .statusbar { flex-wrap: wrap; gap: 8px; font-size: 11px; }
  .welcome-panel { padding: 24px 20px; max-width: 90%; }
}



/* Naive UI 设置弹窗容器 */
.settings-inner { max-height: 60vh; overflow-y: auto; }
.settings-section { padding: 6px 0; }
.settings-section + .settings-section { border-top: 1px solid var(--border-soft, rgba(128,128,128,.18)); margin-top: 12px; }
.settings-title { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
.settings-hint { font-size: 11px; color: var(--text-muted); font-weight: 400; }
.plugin-list { display: flex; flex-direction: column; gap: 2px; }
.plugin-row { display: flex; align-items: center; gap: 8px; padding: 3px 0; font-size: 13px; }
.plugin-name { flex: 1; }
.plugin-id { font-size: 11px; color: var(--text-muted); }
.settings-actions { display: flex; gap: 8px; }

/* 设置中心：左侧页签 + 右侧内容，整体限高防超屏 */
.settings-shell { display: flex; height: min(560px, 72vh); }
.settings-nav { width: 148px; flex-shrink: 0; border-right: 1px solid var(--border-soft); padding-top: 4px; }
.settings-body { flex: 1; min-width: 0; overflow-y: auto; padding: 2px 18px 10px; }
.settings-section { padding: 4px 0; }
.settings-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.settings-label { font-size: 13px; color: var(--text-muted); white-space: nowrap; }
.settings-desc { font-size: 12px; color: var(--text-muted); line-height: 1.7; margin-bottom: 12px; }
/* 编辑区字体：覆盖 milkdown/nord 的 .milkdown .ProseMirror font-size（容器继承会被它吃掉） */
.editor-root .milkdown .ProseMirror { font-size: var(--editor-font-size, 16px); }
/* 区块字号映射：代码块 = 基准 × 0.875；标题/列表/引用经 em 按官方倍数自动缩放 */
.editor-root .milkdown .code-block-wrapper code { font-size: calc(var(--editor-font-size, 16px) * 0.875); }
/* 侧边栏收起（替代原 聚焦/无干扰 模式） */
.sidebar.collapsed { display: none; }
/* 图片预览大图 */
.image-preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: rgba(0, 0, 0, 0.78);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
}
.image-preview-img {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
}
.image-preview-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  font-size: 18px;
  cursor: pointer;
}
.image-preview-close:hover { background: rgba(255, 255, 255, 0.3); }
/* 插入链接双输入 */
.link-dialog { padding: 4px 0; }
.link-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>
