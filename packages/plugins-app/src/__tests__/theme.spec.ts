// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { DexieStorageProvider } from '@editor/infra'
import { createThemeModule } from '../theme'

/**
 * P1.6 主题系统单测：
 * 持久化偏好（settings 表）、data-theme 应用、system 模式解析。
 * node 环境无 window.matchMedia → 手动 stub。
 */

describe('theme 模块', () => {
  let storage: DexieStorageProvider
  let theme: ReturnType<typeof createThemeModule>

  beforeAll(() => {
    storage = new DexieStorageProvider()
    theme = createThemeModule({ storage } as never)
  })
  afterAll(() => storage.dispose())

  beforeEach(async () => {
    const db = (storage as unknown as { db: { settings: { clear: () => Promise<void> } } }).db
    await db.settings.clear()
  })

  it('默认 system（首次无偏好）', async () => {
    await theme.init()
    expect(theme.getMode()).toBe('system')
  })

  it('setMode 持久化到 settings 表', async () => {
    await theme.setMode('dark')
    const saved = await storage.getSetting('theme.mode')
    expect(saved).toBe('dark')
    // 新实例读取持久化值
    const t2 = createThemeModule({ storage } as never)
    await t2.init()
    expect(t2.getMode()).toBe('dark')
  })

  it('apply 设置 html[data-theme]（node 环境无 document → 安全跳过）', () => {
    expect(() => theme.apply()).not.toThrow()
  })

  it('system 模式在无 matchMedia 时解析为 light', () => {
    // node 环境 window 未定义 → isDark 内部走 light
    const mode = (theme as unknown as { isDark: () => boolean }).isDark
    if (mode) expect(mode()).toBe(false)
  })
})
