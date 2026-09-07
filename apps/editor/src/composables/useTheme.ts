/**
 * 主题：mode（亮/暗/系统）+ naive 主题桥接（resolvedDark → naiveTheme/naiveOverrides）。
 * naiveOverrides 从 data-theme CSS 变量派生（DOM 计算样式非响应式 → 依赖 resolvedDark 触发重算）。
 */
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { darkTheme, type GlobalThemeOverrides } from "naive-ui";
import { useShell } from "./useShell";

export function useTheme() {
  const { boot } = useShell();

  const themeMode = ref<"light" | "dark" | "system">("system");
  const themeLabel = computed(() =>
    themeMode.value === "system" ? "🌓" : themeMode.value === "dark" ? "🌙" : "☀️"
  );

  async function setTheme(m: "light" | "dark" | "system") {
    const t = (boot.value?.api as never as Record<string, unknown>).theme as { setMode: (m: string) => Promise<void> } | undefined;
    if (!t) return;
    await t.setMode(m);
    themeMode.value = m;
  }
  async function toggleTheme() {
    const t = (boot.value?.api as never as Record<string, unknown>).theme as { setMode: (m: string) => Promise<void>; getMode: () => string } | undefined;
    if (!t) return;
    const cycle: Record<string, string> = { system: "light", light: "dark", dark: "system" };
    const next = cycle[t.getMode()] ?? "light";
    await t.setMode(next as never);
    themeMode.value = next as never;
  }
  function onThemeModeChange(m: string | number) {
    void setTheme(m as "light" | "dark" | "system");
  }

  /** 实际生效暗色（跟随 html[data-theme]，MutationObserver 保证任何时序） */
  const resolvedDark = ref(false);
  let themeObserver: MutationObserver | null = null;
  function syncResolvedDark() {
    resolvedDark.value = document.documentElement.getAttribute("data-theme") === "dark";
  }
  syncResolvedDark();

  const naiveTheme = computed(() => (resolvedDark.value ? darkTheme : null));
  const naiveOverrides = computed<GlobalThemeOverrides>(() => {
    void resolvedDark.value; // 响应式依赖：data-theme 变化后重算
    const s = getComputedStyle(document.documentElement);
    const v = (name: string) => s.getPropertyValue(name).trim() || undefined;
    return {
      common: {
        primaryColor: v("--accent"),
        primaryColorHover: v("--accent"),
        primaryColorPressed: v("--accent"),
        primaryColorSuppl: v("--accent"),
        bodyColor: v("--bg"),
        cardColor: v("--bg"),
        modalColor: v("--bg"),
        popoverColor: v("--bg-soft"),
        tooltipColor: v("--bg"),
        inputColor: v("--bg-soft"),
        inputColorDisabled: v("--bg-soft"),
        inputTextColor: v("--text"),
        textColorBase: v("--text"),
        textColor1: v("--text"),
        textColor2: v("--text"),
        textColor3: v("--text-muted"),
        textColorDisabled: v("--text-muted"),
        borderColor: v("--border"),
        borderColorStrong: v("--border"),
        dividerColor: v("--border-soft"),
        borderRadius: "6px",
      },
    };
  });

  /** 主题 observer 生命周期（App onMounted/onBeforeUnmount 对接） */
  function startThemeObserver() {
    syncResolvedDark();
    themeObserver = new MutationObserver(syncResolvedDark);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }
  function stopThemeObserver() {
    themeObserver?.disconnect();
    themeObserver = null;
  }

  return { themeMode, themeLabel, resolvedDark, naiveTheme, naiveOverrides, setTheme, toggleTheme, onThemeModeChange, startThemeObserver, stopThemeObserver };
}
