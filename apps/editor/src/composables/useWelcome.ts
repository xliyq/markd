/**
 * 首启欢迎引导 + 空库提示 + 快速记录（M1.12）。
 */
import { ref } from "vue";
import { useShell } from "./useShell";

export function useWelcome(openDoc: (docId: string) => Promise<void>) {
  const { boot, statusText, treeRef } = useShell();

  const showWelcome = ref(false);
  const showEmptyHint = ref(false);
  const createDocDialog = ref(false);

  async function dismissWelcome() {
    showWelcome.value = false;
    await boot.value?.storage.setSetting("first-run.v1", true);
  }

  async function welcomeCreateDoc() {
    createDocDialog.value = true;
  }
  async function onCreateDocConfirm(name: string) {
    createDocDialog.value = false;
    const v = name.trim();
    if (!v || !boot.value) return;
    const dt = (boot.value.api as never as Record<string, unknown>).documentTree as { create: (name: string) => Promise<{ id: string }> };
    const node = await dt.create(v);
    await treeRef.value?.refresh();
    await openDoc(node.id);
    await dismissWelcome();
    showEmptyHint.value = false;
  }

  async function welcomeQuickNote() {
    if (!boot.value) return;
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const dt = (boot.value.api as never as Record<string, unknown>).documentTree as { create: (name: string) => Promise<{ id: string }> };
    const node = await dt.create(`速记 ${stamp}`);
    await treeRef.value?.refresh();
    await openDoc(node.id);
    await dismissWelcome();
    showEmptyHint.value = false;
  }

  async function checkEmptyLibrary(): Promise<boolean> {
    if (!boot.value) return false;
    const dt = (boot.value.api as never as Record<string, unknown>).documentTree as { list: (p: string | null) => Promise<unknown[]> };
    const roots = await dt.list(null);
    return roots.length === 0;
  }

  return { showWelcome, showEmptyHint, createDocDialog, dismissWelcome, welcomeCreateDoc, onCreateDocConfirm, welcomeQuickNote, checkEmptyLibrary };
}
