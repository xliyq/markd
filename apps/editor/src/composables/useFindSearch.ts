/**
 * 查找/替换 + 全文搜索面板状态与逻辑（Ctrl+F / Ctrl+Shift+F）。
 */
import { ref } from "vue";
import { getFindReplace } from "@editor/plugins-editor";
import { useShell } from "./useShell";

export function useFindSearch(openDoc: (docId: string) => Promise<void>) {
  const { boot, statusText } = useShell();

  /** 查找/替换面板 */
  const findOpen = ref(false);
  const findQuery = ref("");
  const findReplacement = ref("");
  const findTotal = ref(0);
  const findCurrent = ref(0);

  /** 全文搜索面板（ADR-016 / Phase 5） */
  const searchOpen = ref(false);
  const searchQuery = ref("");
  const searchResults = ref<{ id: string; name: string; snippet: string; score: number }[]>([]);
  const searchTotal = ref(0);

  function getSearchMod() {
    type SM = {
      search: (q: string, topN?: number) => { id: string; name: string; snippet: string; score: number }[];
    };
    return ((boot.value?.api as never as Record<string, unknown>).search as SM | undefined) ?? null;
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
  function onSearchQueryInput(v: string) {
    searchQuery.value = v;
    onSearchInput();
  }

  function getFindCtrl() {
    return getFindReplace();
  }
  function openFind() {
    findOpen.value = true;
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
  function onFindQueryInput(v: string) {
    findQuery.value = v;
    onFindInput();
  }

  /** 全局快捷键（Ctrl+F / Ctrl+Shift+F / Esc 关查找）→ 返回清理函数 */
  function installGlobalKeys() {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        openFind();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchOpen.value = true;
        searchQuery.value = "";
        searchResults.value = [];
        void onSearchInput();
      }
      if (e.key === "Escape" && findOpen.value) {
        closeFind();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }

  return {
    findOpen, findQuery, findReplacement, findTotal, findCurrent,
    searchOpen, searchQuery, searchResults, searchTotal,
    openFind, onFindInput, onFindNext, onFindPrev, onReplaceOne, onReplaceAll, closeFind, onFindQueryInput,
    onSearchInput, openSearchResult, closeSearch, onSearchQueryInput,
    installGlobalKeys,
  };
}
