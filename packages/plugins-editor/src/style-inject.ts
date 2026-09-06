/**
 * 插件样式注入（样式随插件走，ADR-021）：
 * 插件 create() 时调用，把 style.css 文本注入 <head>（幂等：同 key 只注入一次）。
 * 守卫：无 document（SSR/测试早期）时静默跳过。
 */
const injected = new Set<string>()

export function injectPluginStyle(key: string, css: string): void {
  if (typeof document === "undefined" || injected.has(key)) return
  injected.add(key)
  const style = document.createElement("style")
  style.setAttribute("data-plugin", key)
  style.textContent = css
  document.head.appendChild(style)
}
