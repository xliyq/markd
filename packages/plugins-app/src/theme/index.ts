/**
 * 主题系统（P1.6）
 *
 * L2 模块：亮/暗主题切换 + 偏好持久化（settings 表）+ 跟随系统。
 * 实现：html[data-theme="dark"] + CSS 变量（token），App 样式全部走 token。
 */
import type { AppModuleManifest, AppApi } from '@editor/core'

export type ThemeMode = 'light' | 'dark' | 'system'

export interface ThemeModule {
  /** 当前主题模式 */
  getMode: () => ThemeMode
  /** 切换主题并持久化 */
  setMode: (mode: ThemeMode) => Promise<void>
  /** 应用主题到 document（html[data-theme]） */
  apply: () => void
  /** 跟随系统（system 模式监听 prefers-color-scheme） */
  watchSystem: () => void
  /** 初始化：读持久化偏好 → 应用 */
  init: () => Promise<void>
}

const SETTING_KEY = 'theme.mode'

export function createThemeModule(api: AppApi): ThemeModule {
  const storage = api.storage
  let mode: ThemeMode = 'light'

  /** 计算实际暗色（mode=system 时看系统偏好） */
  function isDark(): boolean {
    if (mode === 'dark') return true
    if (mode === 'system') {
      return typeof window !== 'undefined'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : false
    }
    return false
  }

  function apply(): void {
    if (typeof document === 'undefined') return
    document.documentElement.setAttribute('data-theme', isDark() ? 'dark' : 'light')
  }

  function watchSystem(): void {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (mode === 'system') apply()
    }
    media.addEventListener('change', handler)
  }

  let initPromise: Promise<void> | null = null
  /** 幂等初始化：共享 promise，mount 触发与 App await 都落到同一次完成 */
  function init(): Promise<void> {
    if (initPromise) return initPromise
    initPromise = (async () => {
      const saved = await storage?.getSetting<ThemeMode>(SETTING_KEY)
      mode = saved || 'system'
      apply()
      watchSystem()
    })()
    return initPromise
  }

  async function setMode(next: ThemeMode): Promise<void> {
    mode = next
    apply()
    await storage?.setSetting(SETTING_KEY, next)
  }

  return { getMode: () => mode, setMode, apply, watchSystem, init }
}

export const themeManifest: AppModuleManifest = {
  id: 'theme',
  type: 'app',
  name: '主题',
  version: '1.0.0',
  description: '亮/暗主题切换 + 持久化（P1.6）',
  dependsOn: [],
  defaultEnabled: true,
  mount: (api) => {
    const mod = createThemeModule(api)
    ;(api as unknown as Record<string, unknown>).theme = mod
    void mod.init()
    return { name: '主题', dispose: () => {
      delete (api as unknown as Record<string, unknown>).theme
    } }
  },
}
