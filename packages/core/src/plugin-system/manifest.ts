/**
 * 插件 manifest 契约（对齐 docs/04-plugin-design.md §3）
 *
 * L1（milkdown）/ L2（app）统一契约：
 * - L1 插件导出 { manifest }，manifest.create 返回 Milkdown 插件
 * - L2 模块导出 { manifest, AppModule }，manifest.mount 注入 AppApi
 */
import type { MilkdownPlugin } from '@milkdown/ctx'
import type { AppApi } from './app-api'

/** 统一基础契约 */
export interface PluginManifest {
  /** 唯一标识，如 'math' / 'document-tree' */
  id: string
  /** 插件层类型 */
  type: 'milkdown' | 'app'
  /** 中文显示名 */
  name: string
  /** 语义化版本 */
  version: string
  /** 功能描述 */
  description: string
  /** 依赖的其他插件 id（被依赖者先装载） */
  dependsOn: string[]
  /** 注册默认是否启用（可被用户设置覆盖） */
  defaultEnabled: boolean
  /** 配置项定义（JSON Schema 风格），设置面板据此自动生成表单 */
  configSchema?: Record<string, unknown>
}

/** L1 扩展：Milkdown 插件工厂 */
export interface MilkdownPluginManifest extends PluginManifest {
  type: 'milkdown'
  /** 返回一个或多个 Milkdown 插件（数组会被展开） */
  create: () => MilkdownPlugin | MilkdownPlugin[]
}

/** L2 应用模块的返回体 */
export interface AppModule {
  /** 中文名；可为空（纯命令/纯事件型模块） */
  name?: string
  /** 卸载时调用（清理监听/定时器） */
  dispose?: () => void
}

/** L2 扩展：应用模块工厂 */
export interface AppModuleManifest extends PluginManifest {
  type: 'app'
  /** 挂载：注入应用 API，返回模块句柄 */
  mount: (api: AppApi) => AppModule | void
}

/** 判别联合 */
export type AnyPluginManifest = MilkdownPluginManifest | AppModuleManifest

/** 类型守卫 */
export function isMilkdownManifest(m: AnyPluginManifest): m is MilkdownPluginManifest {
  return m.type === 'milkdown'
}

export function isAppManifest(m: AnyPluginManifest): m is AppModuleManifest {
  return m.type === 'app'
}
