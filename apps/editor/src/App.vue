<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, nextTick, computed } from "vue";
import { bootstrapApp } from "./bootstrap";
import type { AppBootstrap } from "./bootstrap";
import FileTree from "./components/FileTree.vue";
import InputDialog from "./components/InputDialog.vue";
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
import Lightbox from "./components/Lightbox.vue";
import { NConfigProvider, darkTheme, type GlobalThemeOverrides } from "naive-ui";
import { useShell } from "./composables/useShell";
import { useEditor } from "./composables/useEditor";
import { useDialogs } from "./composables/useDialogs";
import { useTheme } from "./composables/useTheme";
import { useFindSearch } from "./composables/useFindSearch";
import { useSettings } from "./composables/useSettings";
import { useExport } from "./composables/useExport";
import { useWelcome } from "./composables/useWelcome";

/** 共享壳状态（单例） */
const {
  boot, statusText, activeDocId, docName, activeId, conflictMsg, copyToast,
  sidebarCollapsed, treeModule, fileInput, editorRoot, treeRef,
} = useShell();

/** 编辑器编排 */
const {
  docTitle, outline, sidebarTab, statsText, lastMarkdown, sourceMode, sourceText, previewImg,
  focusEditor, onToolbar, onDocChanged, toggleSourceMode, rebuildEditor, onEditorClick, openDoc,
} = useEditor();

/** 弹窗桥（prompt/link/image） */
const {
  promptDialog, onPromptConfirm, onPromptCancel,
  linkDialog, linkForm, onLinkConfirm, onLinkCancel,
  imageDialog, imageForm, onImageFilePicked, onImageConfirm, onImageCancel,
  registerPromptBridges,
} = useDialogs();

/** 主题 */
const {
  themeMode, themeLabel, naiveTheme, naiveOverrides,
  setTheme, toggleTheme, onThemeModeChange, startThemeObserver, stopThemeObserver,
} = useTheme();

/** 查找/全文搜索 */
const {
  findOpen, findQuery, findReplacement, findTotal, findCurrent,
  searchOpen, searchQuery, searchResults, searchTotal,
  openFind, onFindInput, onFindNext, onFindPrev, onReplaceOne, onReplaceAll, closeFind, onFindQueryInput,
  onSearchInput, openSearchResult, closeSearch, onSearchQueryInput, installGlobalKeys,
} = useFindSearch(openDoc);

/** 设置中心 */
const {
  showSettings, settingsTab, settingsTabs, pluginSwitches,
  editorPrefs, fontOptions, widthOptions,
  loadEditorPrefs, setFontSize, setMaxWidth, loadPluginSwitches, togglePlugin, onOpenSettings,
} = useSettings(rebuildEditor);

/** 导出 */
const { exportOptions, onExportSelect } = useExport();

/** 首启欢迎 + 空库提示 */
const {
  showWelcome, showEmptyHint, createDocDialog,
  dismissWelcome, welcomeCreateDoc, onCreateDocConfirm, welcomeQuickNote, checkEmptyLibrary,
} = useWelcome(openDoc);

/** ── 壳层杂项（导入/备份/恢复/复制 toast/冲突提示） ── */
let conflictTimer: ReturnType<typeof setTimeout> | null = null;
let copyToastTimer: ReturnType<typeof setTimeout> | null = null;
const onCodeCopied = () => {
  copyToast.value = true;
  if (copyToastTimer) clearTimeout(copyToastTimer);
  copyToastTimer = setTimeout(() => (copyToast.value = false), 1500);
};
const onLinkCopied = (e: Event) => {
  const link = (e as CustomEvent<{ link: string }>).detail?.link ?? "";
  statusText.value = `链接已复制：${link}`;
  copyToast.value = true;
  if (copyToastTimer) clearTimeout(copyToastTimer);
  copyToastTimer = setTimeout(() => (copyToast.value = false), 1500);
};

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

function onRestoreFile(file: File) {
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

function onTreeChanged() {
  statusText.value = "文档树已更新";
}

onMounted(async () => {
  startThemeObserver();
  try {
    boot.value = await bootstrapApp();
    statusText.value = "就绪";
    const dt = boot.value.api.documentTree as Record<string, unknown> | undefined;
    treeModule.value = dt ?? null;
    // 订阅文档变更 → 大纲/字数实时更新
    boot.value.pm.on("doc:changed", (payload) => {
      const p = payload as { docId: string; markdown: string };
      onDocChanged(p.markdown);
    });
    // 主题初始状态（theme.init 异步，await 同一次 promise）
    const t = boot.value.api.theme as { init: () => Promise<void>; getMode: () => string } | undefined;
    if (t) {
      await t.init();
      themeMode.value = t.getMode() as never;
    }
    // 注册弹窗桥（链接/图片/通用文本）
    registerPromptBridges();
    // 首启引导 + 空库引导
    const firstRun = await boot.value.storage.getSetting("first-run.v1");
    const emptyLib = await checkEmptyLibrary();
    if (!firstRun) {
      showWelcome.value = true;
    } else if (emptyLib) {
      showEmptyHint.value = true;
    }
    // 全局快捷键（Ctrl+F / Ctrl+Shift+F / Esc）
    const removeKeys = installGlobalKeys();
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && findOpen.value) closeFind();
    });
    void removeKeys; // installGlobalKeys 已挂自身 handler
    // 多标签冲突
    boot.value.pm.on("doc:conflict", (payload) => {
      const p = payload as { docId: string; contentHash: string; at: number };
      conflictMsg.value = `⚠️ 检测到其他标签页也编辑了本文档（${new Date(p.at).toLocaleTimeString()}）——当前内容可能被覆盖`;
      if (conflictTimer) clearTimeout(conflictTimer);
      conflictTimer = setTimeout(() => (conflictMsg.value = null), 6000);
    });
    // 复制成功提示
    window.addEventListener("milkdown:code-copied", onCodeCopied);
    window.addEventListener("milkdown:link-copied", onLinkCopied);
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
    onDocChanged(md);
    await loadEditorPrefs();
    statusText.value = "编辑器已就绪";
  }
});

onBeforeUnmount(() => {
  stopThemeObserver();
  window.removeEventListener("milkdown:code-copied", onCodeCopied);
  window.removeEventListener("milkdown:link-copied", onLinkCopied);
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
      <!-- 灯箱预览（M4.6：点击图片全屏放大/缩放/平移/多图切换/下载复制） -->
      <Lightbox
        v-if="previewImg"
        :images="previewImg.images"
        :index="previewImg.index"
        @close="previewImg = null"
        @update:index="(i: number) => previewImg && (previewImg.index = i)"
      />
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
/* 通用按钮（空库提示等壳层内按钮） */
.toolbar-btn {
  border: 1px solid var(--border);
  background: var(--bg-soft);
  color: var(--text);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 13px;
  cursor: pointer;
}
.toolbar-btn:hover { border-color: var(--accent); color: var(--accent); }
.sidebar-empty {
  padding: 20px 12px;
  color: var(--text-muted);
  font-size: 13px;
  text-align: center;
}
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
/* 编辑区字体：覆盖 milkdown/nord 的 .milkdown .ProseMirror font-size（容器继承会被它吃掉） */
.editor-root .milkdown .ProseMirror { font-size: var(--editor-font-size, 16px); }
/* 区块字号映射：代码块 = 基准 × 0.875；标题/列表/引用经 em 按官方倍数自动缩放 */
.editor-root .milkdown .code-block-wrapper code { font-size: calc(var(--editor-font-size, 16px) * 0.875); }
/* 侧边栏收起（替代原 聚焦/无干扰 模式） */
.sidebar.collapsed { display: none; }
/* 图片预览大图 */
</style>
