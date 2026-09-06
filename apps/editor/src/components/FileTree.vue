<script setup lang="ts">
/**
 * 文档树（Naive UI n-tree 版）+ 自研对话框
 *
 * 从手写递归 <ul>/<li> 树迁移到 n-tree；保留 a11y 语义：
 *  - 每个节点 role="treeitem" + tabindex=0（经 :node-props 注入）
 *  - 焦点置于 treeitem 按 Enter/Space → 打开文档（node-props onKeydown）
 *  - 文件夹点击展开/收起（懒加载子级）
 */
import { ref, reactive, computed, onMounted, h } from "vue";
import { NTree, NButton, NModal, NInput, NRadioGroup, NRadioButton, NSelect } from "naive-ui";
import type { TreeOption } from "naive-ui";
import type { DocNode } from "@editor/shared";
import InputDialog from "./InputDialog.vue";

/** n-tree 选项（raw 保有原始 DocNode 供打开/操作） */
interface NOpt extends TreeOption {
  raw?: DocNode;
}

const props = defineProps<{
  /** documentTree 模块实例（AppApi 暴露） */
  tree: {
    list: (parentId: string | null) => Promise<DocNode[]>;
    create: (name: string, parentId?: string | null) => Promise<DocNode>;
    createFolder: (name: string, parentId?: string | null) => Promise<DocNode>;
    rename: (id: string, name: string) => Promise<void>;
    remove: (id: string) => Promise<void>;
  } | null;
  /** 当前打开文档 id（高亮） */
  activeId: string | null;
}>();

const emit = defineEmits<{
  (e: "open", docId: string): void;
  (e: "changed"): void;
}>();

const roots = ref<DocNode[]>([]);
const loading = ref(true);
/** 文件夹懒加载的子级缓存：folderId -> DocNode[] */
const serverChildren = reactive<Record<string, DocNode[]>>({});
const expandedKeys = ref<string[]>([]);

function toOpt(n: DocNode): NOpt {
  return {
    key: n.id,
    label: n.name,
    isLeaf: n.type !== "folder",
    raw: n,
    children: n.type === "folder" ? (serverChildren[n.id] ?? []).map(toOpt) : undefined,
  };
}
const treeData = computed<NOpt[]>(() => roots.value.map(toOpt));

function findOpt(list: NOpt[], key: string): NOpt | undefined {
  for (const o of list) {
    if (o.key === key) return o;
    if (o.children) {
      const r = findOpt(o.children as NOpt[], key);
      if (r) return r;
    }
  }
  return undefined;
}

async function refresh() {
  if (!props.tree) return;
  loading.value = true;
  try {
    roots.value = (await props.tree.list(null)) as DocNode[];
    Object.keys(serverChildren).forEach((k) => delete serverChildren[k]);
  } finally {
    loading.value = false;
  }
}

/** 展开/收起：新增展开的文件夹懒加载子级 */
async function onExpand(keys: string[]) {
  const prev = expandedKeys.value;
  expandedKeys.value = keys;
  const newly = keys.filter((k) => !prev.includes(k));
  for (const k of newly) {
    if (serverChildren[k]) continue;
    const kids = (await props.tree?.list(k)) as DocNode[] | undefined;
    if (Array.isArray(kids)) serverChildren[k] = kids;
  }
}

/** 打开/展开一个节点 */
function openNodeOf(opt: NOpt) {
  const n = opt.raw;
  if (!n) return;
  if (n.type === "folder") {
    onExpand(
      expandedKeys.value.includes(n.id)
        ? expandedKeys.value.filter((x) => x !== n.id)
        : [...expandedKeys.value, n.id],
    );
  } else {
    emit("open", n.id);
  }
}

/** 点击选择：文档打开，文件夹展开/收起 */
async function onSelect(keys: string[] | Array<string> | null) {
  if (!keys || !keys.length) return;
  const opt = findOpt(treeData.value, keys[0]);
  if (opt) openNodeOf(opt);
}

/** 树容器键盘导航（naive 内置 keyboard 关闭后自管）：
 *  Enter/Space 打开文档或展开文件夹；Arrow 上下 / Home / End 移动焦点（焦点始终在 treeitem 上） */
function focusTreeItemAt(index: number) {
  const items = Array.from(
    document.querySelectorAll('.file-tree__tree [role="treeitem"]'),
  ) as HTMLElement[];
  items[index]?.focus();
}
/** 树先序展平（与 naive 渲染的 treeitem DOM 顺序一致，仅含展开节点） */
function flatOptions(list: NOpt[]): NOpt[] {
  const out: NOpt[] = [];
  for (const o of list) {
    out.push(o);
    if (o.children && o.children.length && expandedKeys.value.includes(o.key)) {
      out.push(...flatOptions(o.children as NOpt[]));
    }
  }
  return out;
}
function onTreeKeydown(e: KeyboardEvent) {
  const items = Array.from(
    document.querySelectorAll('.file-tree__tree [role="treeitem"]'),
  ) as HTMLElement[];
  const cur = document.activeElement as HTMLElement | null;
  const idx = cur ? items.indexOf(cur) : -1;
  const flat = flatOptions(treeData.value);
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (idx < items.length - 1) focusTreeItemAt(idx + 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (idx > 0) focusTreeItemAt(idx - 1);
  } else if (e.key === "Home") {
    e.preventDefault();
    focusTreeItemAt(0);
  } else if (e.key === "End") {
    e.preventDefault();
    focusTreeItemAt(items.length - 1);
  } else if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    const opt = idx >= 0 ? flat[idx] : undefined;
    if (opt) openNodeOf(opt);
  }
}

/** 节点 props：注入 a11y treeitem + tabindex + Enter/Space 打开 */
function nodeProps(option: NOpt): Record<string, unknown> {
  const n = option.raw;
  const active = !!n && n.id === props.activeId;
  return {
    role: "treeitem",
    tabIndex: 0,
    "aria-selected": active ? "true" : "false",
    "aria-expanded":
      n?.type === "folder"
        ? expandedKeys.value.includes(n.id)
          ? "true"
          : "false"
        : undefined,
    "aria-label": n?.name,
    onKeydown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openNodeOf(option);
      }
    },
  };
}

/** 操作图标（SVG 清晰版） */
const ICON_RENAME = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>';
const ICON_DELETE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>';
const ICON_ADD_DOC = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6M9 15h6"/></svg>';
const ICON_ADD_FOLDER = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><path d="M12 17v-6M9 14h6"/></svg>';

/** 文档大小格式化 */
function fmtSize(n?: number): string {
  if (n == null) return "";
  return n < 1024 ? `${n}B` : `${(n / 1024).toFixed(1)}KB`;
}

/** 对话框状态 */
const dialog = ref<{
  mode: "create" | "folder" | "rename" | "confirm";
  title: string;
  placeholder?: string;
  initialValue?: string;
  message?: string;
  danger?: boolean;
  node?: DocNode;
  parentId?: string | null;
} | null>(null);

/** 新增弹窗（类型 + 名称 + 目标目录；根级或指定文件夹下） */
const createDialog = ref<{ parentName?: string } | null>(null);
const createForm = ref({ type: "doc" as "doc" | "folder", name: "", parentId: "root" });

/** 递归收集所有文件夹 → 位置下拉选项 */
function collectFolders(list: NOpt[], depth = 0): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  for (const o of list) {
    if (o.raw?.type === "folder") {
      out.push({ label: `${"　".repeat(depth)}${o.raw.name}`, value: o.raw.id });
      if (o.children?.length) out.push(...collectFolders(o.children as NOpt[], depth + 1));
    }
  }
  return out;
}
const folderOptions = computed(() => [
  { label: "根目录", value: "root" },
  ...collectFolders(treeData.value),
]);

function openCreate(parentId: string | null = null, parentName?: string, type: "doc" | "folder" = "doc") {
  createDialog.value = { parentName };
  createForm.value = { type, name: "", parentId: parentId ?? "root" };
}
function onCreateConfirm() {
  const v = createForm.value.name.trim();
  if (!v || !props.tree) return;
  const p = createForm.value.parentId === "root" ? null : createForm.value.parentId;
  const done = createForm.value.type === "doc" ? props.tree.create(v, p) : props.tree.createFolder(v, p);
  done.then(() => { emit("changed"); refresh(); });
  createDialog.value = null;
}
function renameNode(node?: DocNode) {
  if (!node) return;
  dialog.value = { mode: "rename", title: "重命名", placeholder: "名称", initialValue: node.name, node };
}
function removeNode(node?: DocNode) {
  if (!node) return;
  dialog.value = { mode: "confirm", title: "删除确认", message: `确定删除「${node.name}」？删除后进入回收站（保留 30 天）。`, danger: true, node };
}

function onDialogConfirm(value: string) {
  const d = dialog.value;
  if (!d || !props.tree) return;
  const v = value.trim();
  if (d.mode === "rename" && d.node) {
    if (!v || v === d.node.name) return;
    props.tree.rename(d.node.id, v).then(() => { emit("changed"); refresh(); });
  } else if (d.mode === "confirm" && d.node) {
    props.tree.remove(d.node.id).then(() => { emit("changed"); refresh(); });
  }
  dialog.value = null;
}
function onDialogCancel() {
  dialog.value = null;
}

/** 节点前缀：图标（文件夹 📁/📂，文档 📄，当前文档 📌） */
function renderPrefix(info: { option: TreeOption }): ReturnType<typeof h> {
  const n = (info.option as NOpt).raw;
  const icon =
    n?.type === "folder"
      ? expandedKeys.value.includes(info.option.key)
        ? "📂"
        : "📁"
      : n?.id === props.activeId
        ? "📌"
        : "📄";
  return h("span", { class: "node-icon", "aria-hidden": "true" }, icon);
}

/** 节点后缀：文档大小 + 操作（文件夹行含「在此新建」按钮） */
function renderSuffix(info: { option: TreeOption }): ReturnType<typeof h> {
  const n = (info.option as NOpt).raw;
  const stop = (e: Event) => e.stopPropagation();
  if (!n) return h("span");
  const children: ReturnType<typeof h>[] = [];
  if (n.type === "doc") {
    children.push(h("span", { class: "node-size" }, fmtSize(n.size)));
  }
  children.push(
    h("span", { class: "node-actions", onClick: stop }, [
      h("button", { class: "mini-btn", title: "重命名", innerHTML: ICON_RENAME, onClick: (e: MouseEvent) => { stop(e); renameNode(n); } }),
      h("button", { class: "mini-btn danger", title: "删除", innerHTML: ICON_DELETE, onClick: (e: MouseEvent) => { stop(e); removeNode(n); } }),
    ]),
  );
  return h("span", {}, children);
}

onMounted(refresh);
defineExpose({ refresh });
</script>

<template>
  <div class="file-tree">


    <div class="tree-toolbar">
      <n-button size="small" type="primary" ghost title="新增文档或文件夹" @click="openCreate()">＋ 新增</n-button>
    </div>

    <div v-if="loading" class="tree-empty">加载中…</div>
    <div v-else-if="roots.length === 0" class="tree-empty">
      暂无文档<br />
      <small>点击上方按钮新建</small>
    </div>

    <n-tree
      v-else
      class="file-tree__tree"
      block-line
      :data="treeData"
      :expanded-keys="expandedKeys"
      :node-props="nodeProps"
      :selectable="true"
      :keyboard="false"
      :indent="20"
      :render-prefix="renderPrefix"
      :render-suffix="renderSuffix"
      role="tree"
      aria-label="文档树"
      @keydown="onTreeKeydown"
      @update:expanded-keys="onExpand"
      @update:selected-keys="onSelect"
    />

    <!-- 新增弹窗：类型（文档/文件夹）+ 名称 -->
    <n-modal
      :show="!!createDialog"
      preset="card"
      :title="createDialog?.parentName ? `新增 · 位于「${createDialog.parentName}」` : '新增'"
      :style="{ width: '360px', maxWidth: '90vw' }"
      @update:show="(v: boolean) => { if (!v) createDialog = null }"
    >
      <div class="create-dialog">
        <div class="settings-row">
          <span class="settings-label">位置</span>
          <n-select
            v-model:value="createForm.parentId"
            :options="folderOptions"
            size="small"
            style="width: 210px"
          />
        </div>
        <div class="settings-row">
          <span class="settings-label">类型</span>
          <n-radio-group v-model:value="createForm.type" size="small">
            <n-radio-button value="doc">📄 文档</n-radio-button>
            <n-radio-button value="folder">📁 文件夹</n-radio-button>
          </n-radio-group>
        </div>
        <div class="settings-row">
          <span class="settings-label">名称</span>
          <n-input v-model:value="createForm.name" size="small" placeholder="名称" style="width: 210px" @keydown.enter="onCreateConfirm" />
        </div>
      </div>
      <template #footer>
        <div class="link-dialog-actions">
          <n-button size="small" @click="createDialog = null">取消</n-button>
          <n-button size="small" type="primary" @click="onCreateConfirm">创建</n-button>
        </div>
      </template>
    </n-modal>

    <InputDialog
      :open="!!dialog"
      :title="dialog?.title || ''"
      :message="dialog?.mode === 'confirm' ? dialog?.message : undefined"
      :placeholder="dialog?.placeholder"
      :initial-value="dialog?.initialValue !== undefined ? dialog?.initialValue : (dialog?.placeholder ? '' : undefined)"
      :danger="dialog?.danger"
      :confirm-text="dialog?.mode === 'confirm' ? '删除' : '确定'"
      @confirm="onDialogConfirm"
      @cancel="onDialogCancel"
    />
  </div>
</template>

<style scoped>
.file-tree { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.tree-toolbar { display: flex; gap: 6px; padding: 8px 10px; border-bottom: 1px solid var(--border-soft); }
.tree-empty { padding: 24px 12px; color: var(--text-muted); font-size: 13px; text-align: center; }
.file-tree__tree { flex: 1; overflow-y: auto; padding: 4px; font-size: 13px; }
.node-icon { font-size: 12px; margin-right: 2px; }
.node-size { font-size: 11px; color: var(--text-muted); margin-right: 4px; flex-shrink: 0; }
/* 文件名单行省略（不换行） */
.file-tree__tree :deep(.n-tree-node-content__text) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}
/* 操作按钮 SVG 图标 */
.mini-btn { display: inline-flex; align-items: center; justify-content: center; line-height: 1; }
.mini-btn svg { display: block; }
.create-dialog { padding: 4px 0; }
.file-tree__tree :deep(.n-tree-node--selected) .n-tree-node-content { color: var(--accent); font-weight: 600; }
</style>
<style>
/* 渲染函数（render-suffix h()）创建的节点无 scoped data-v，必须全局样式 */
.node-actions { display: none; gap: 2px; }
.node-actions > .mini-btn { border: none; background: none; cursor: pointer; font-size: 12px; padding: 1px 3px; color: var(--text-muted); }
.node-actions > .mini-btn:hover { color: var(--accent); }
.node-actions > .mini-btn.danger:hover { color: #ef4444; }
.file-tree__tree .n-tree-node:hover .node-actions,
.file-tree__tree .n-tree-node--selected .node-actions { display: inline-flex; }
</style>
