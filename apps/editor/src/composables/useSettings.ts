/**
 * 设置中心：页签状态、插件开关（真实启停）、编辑器偏好（字体/宽度）。
 */
import { ref } from "vue";
import { useShell } from "./useShell";

type FontSize = "small" | "medium" | "large" | "xlarge";
const FONT_SIZE_MAP: Record<FontSize, number> = { small: 14, medium: 16, large: 18, xlarge: 20 };
const FONT_SIZE_OPTIONS: FontSize[] = ["small", "medium", "large", "xlarge"];
function legacyFontToSize(n: number): FontSize {
  if (n <= 14) return "small";
  if (n <= 16) return "medium";
  if (n <= 18) return "large";
  return "xlarge";
}

export function useSettings(rebuildEditor: () => Promise<void>) {
  const { boot, statusText, editorRoot } = useShell();

  const showSettings = ref(false);
  const settingsTab = ref("general");
  const settingsTabs = [
    { label: "🛠 通用", key: "general" },
    { label: "📝 编辑区", key: "editor" },
    { label: "🧩 插件", key: "plugins" },
    { label: "💾 数据", key: "data" },
  ];
  const pluginSwitches = ref<{ id: string; name: string; enabled: boolean }[]>([]);

  /** 编辑区偏好 */
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
    root.style.setProperty("--editor-font-size", `${FONT_SIZE_MAP[editorPrefs.value.fontSize] ?? 16}px`);
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
      const fsRaw = saved.fontSize;
      const fs: FontSize =
        typeof fsRaw === "number"
          ? legacyFontToSize(fsRaw)
          : fsRaw && FONT_SIZE_OPTIONS.includes(fsRaw as FontSize)
            ? (fsRaw as FontSize)
            : "medium";
      const rawW = saved.maxWidth;
      const w = rawW == null ? "860" : String(rawW) === "1200" ? "full" : String(rawW);
      const valid = ["720", "860", "1000", "full"].includes(w) ? w : "860";
      editorPrefs.value = { fontSize: fs, maxWidth: valid };
    }
    applyEditorPrefs();
  }
  async function saveEditorPrefs() {
    applyEditorPrefs();
    const st = boot.value?.storage as { setSetting?: (k: string, v: unknown) => Promise<unknown> } | undefined;
    try {
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
    b?.persistPluginOverrides();
    await b?.rebuildPlugins();
    const manifest = pm.registry.get(id);
    if (manifest?.type === "milkdown") {
      await rebuildEditor();
    }
    statusText.value = `插件「${cur.name}」已${next ? "启用" : "停用"}（立即生效）`;
  }

  function onOpenSettings() {
    showSettings.value = true;
    loadPluginSwitches();
  }

  return {
    showSettings, settingsTab, settingsTabs, pluginSwitches,
    editorPrefs, fontOptions, widthOptions,
    loadEditorPrefs, setFontSize, setMaxWidth,
    loadPluginSwitches, togglePlugin, onOpenSettings,
  };
}
