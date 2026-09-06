/**
 * 插件管理中心（PluginManager）
 *
 * 对齐 04 §4 的五项职责：
 * 1. 注册：收集 manifest，校验 id 唯一性、依赖可解析
 * 2. 排序：拓扑排序（依赖先于被依赖者）
 * 3. 启停：defaultEnabled + 设置覆盖 → 实际装载集合
 * 4. 暴露 API：向 L2 注入 AppApi
 * 5. 汇总设置：聚合 configSchema
 */
import type { AnyPluginManifest, AppModule } from './manifest'
import type { AppApi } from './app-api'
import type { MilkdownPlugin } from '@milkdown/ctx'
import { isAppManifest, isMilkdownManifest } from './manifest'
import { topoSort } from './topology'

/** 重复注册错误 */
export class DuplicatePluginError extends Error {
  constructor(id: string) {
    super(`Plugin "${id}" is already registered`)
    this.name = 'DuplicatePluginError'
  }
}

/** 未知插件启停错误 */
export class UnknownPluginError extends Error {
  constructor(id: string) {
    super(`Plugin "${id}" is not registered`)
    this.name = 'UnknownPluginError'
  }
}

export interface PluginManagerOptions {
  /** 用户设置覆盖：{ id: boolean }，优先级高于 defaultEnabled */
  enabledOverrides?: Record<string, boolean>
}

/** 一次 mountAll 的产物：L1 插件列表 + L2 模块句柄 */
export interface MountResult {
  /** 拓扑排序后启用的 L1 插件（喂给 Editor.make().use） */
  milkdownPlugins: MilkdownPlugin[]
  /** 启用的 L2 模块及其卸载句柄 */
  appModules: { id: string; module: AppModule }[]
}

export class PluginManager {
  private registry = new Map<string, AnyPluginManifest>()
  private overrides: Record<string, boolean>
  private api: AppApi
  /** 已挂载的 L2 模块（remountEnabled 差异挂载/卸载依据） */
  private mountedL2 = new Map<string, AppModule>()

  /** 简单事件总线（非插件也可监听） */
  private listeners = new Map<string, Set<(payload: unknown) => void>>()

  constructor(options: PluginManagerOptions = {}) {
    this.overrides = options.enabledOverrides ?? {}
    this.api = this.buildApi()
  }

  /** 构建注入 L2 的 AppApi（初始只有基础能力，编辑器/storage 由装配者补充） */
  private buildApi(): AppApi {
    const self = this
    return {
      get manifests() {
        return self.registry as ReadonlyMap<string, AnyPluginManifest>
      },
      get enabledIds(): ReadonlySet<string> {
        return new Set(self.enabledIds())
      },
      getPluginConfig: <T = unknown>(id: string): T | undefined => {
        const m = self.registry.get(id)
        return m?.configSchema as T | undefined
      },
      emit: <T = unknown>(event: string, payload?: T) => {
        self.emit(event, payload)
      },
      on: <T = unknown>(event: string, handler: (payload: T) => void) => {
        return self.on(event, handler as (payload: unknown) => void)
      },
    }
  }

  /**
   * 注入装配者提供的运行时依赖（editor/storage）。
   * mountAll 前调用；会浅合并进 AppApi（不覆盖已存在字段）。
   */
  inject(seed: Partial<Pick<AppApi, 'editor' | 'storage'>>): this {
    Object.assign(this.api, seed)
    return this
  }

  // ---------- 注册 ----------

  /** 注册一个插件 manifest（幂等：同 id 二次注册抛错） */
  register(...manifests: AnyPluginManifest[]): this {
    for (const m of manifests) {
      if (this.registry.has(m.id)) throw new DuplicatePluginError(m.id)
      this.registry.set(m.id, m)
    }
    return this
  }

  /** 批量注册多个 */
  registerAll(manifests: AnyPluginManifest[]): this {
    return this.register(...manifests)
  }

  /** 供 AppApi.enabledIds getter 使用 */
  private enabledIds(): string[] {
    const order = this.resolveOrder()
    return order.filter((id) => this.isEnabled(id))
  }

  // ---------- 启停 ----------

  /** 是否启用某个插件（override > defaultEnabled） */
  isEnabled(id: string): boolean {
    const m = this.registry.get(id)
    if (!m) throw new UnknownPluginError(id)
    return this.overrides[id] ?? m.defaultEnabled
  }

  /** 设置/更新启停（受控覆盖） */
  setEnabled(id: string, enabled: boolean): this {
    if (!this.registry.has(id)) throw new UnknownPluginError(id)
    this.overrides[id] = enabled
    return this
  }

  /** 当前启停覆盖（供装配者持久化，如 localStorage） */
  get enabledOverrides(): Record<string, boolean> {
    return { ...this.overrides }
  }

  /** 已注册的全部 id */
  get ids(): string[] {
    return [...this.registry.keys()]
  }

  // ---------- 排序 ----------

  /** 拓扑排序出装载顺序（全部已注册的 id） */
  resolveOrder(): string[] {
    return topoSort([...this.registry.values()])
  }

  /** 仅启用集合的装载顺序 */
  resolveEnabledOrder(): string[] {
    const order = this.resolveOrder()
    return order.filter((id) => this.isEnabled(id))
  }

  // ---------- 挂载 ----------

  /**
   * 装载：返回 L1 插件列表（供 Editor.make().use）+ 逐个 mount L2。
   * 调用方负责把 milkdownPlugins 喂给编辑器，并把 AppApi.editor/storage 注入后使用。
   */
  mountAll(): MountResult {
    const order = this.resolveEnabledOrder()
    const milkdownPlugins: MilkdownPlugin[] = []
    const appModules: MountResult['appModules'] = []

    for (const id of order) {
      const m = this.registry.get(id)!
      if (isMilkdownManifest(m)) {
        const created = m.create()
        milkdownPlugins.push(...(Array.isArray(created) ? created : [created]))
      } else if (isAppManifest(m)) {
        const module = m.mount(this.api) ?? {}
        appModules.push({ id, module })
        this.mountedL2.set(id, module)
      }
    }

    return { milkdownPlugins, appModules }
  }

  /**
   * 重算启停集合并应用差异（插件开关即时生效）：
   * - L1：重新 create 返回最新插件列表（装配者据此重建编辑器）
   * - L2：仅挂载「新启用」的模块，dispose「被禁用」的模块（不重复挂载）
   */
  remountEnabled(): MilkdownPlugin[] {
    const order = this.resolveEnabledOrder()
    const milkdownPlugins: MilkdownPlugin[] = []
    const enabledL2 = new Set<string>()

    for (const id of order) {
      const m = this.registry.get(id)!
      if (isMilkdownManifest(m)) {
        const created = m.create()
        milkdownPlugins.push(...(Array.isArray(created) ? created : [created]))
      } else if (isAppManifest(m)) {
        enabledL2.add(id)
        if (!this.mountedL2.has(id)) {
          const module = m.mount(this.api) ?? {}
          this.mountedL2.set(id, module)
        }
      }
    }

    // 卸载被禁用的 L2（dispose 清理订阅/定时器；纯注册型由模块自身 dispose 清 api 引用）
    for (const id of [...this.mountedL2.keys()]) {
      if (!enabledL2.has(id)) {
        this.mountedL2.get(id)?.dispose?.()
        this.mountedL2.delete(id)
      }
    }

    return milkdownPlugins
  }

  // ---------- 设置汇总 ----------

  /** 聚合所有已注册插件的 configSchema（供设置面板生成 UI） */
  getSettingsSchema(): { id: string; name: string; schema?: Record<string, unknown> }[] {
    const order = this.resolveOrder()
    return order
      .map((id) => {
        const m = this.registry.get(id)!
        return { id, name: m.name, schema: m.configSchema }
      })
      .filter((x) => x.schema != null)
  }

  // ---------- 事件总线 ----------

  /** 发布事件 */
  emit<T = unknown>(event: string, payload?: T): void {
    const set = this.listeners.get(event)
    if (!set) return
    for (const handler of set) handler(payload)
  }

  /** 订阅事件，返回取消函数 */
  on<T = unknown>(event: string, handler: (payload: T) => void): () => void {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    const h = handler as (payload: unknown) => void
    set.add(h)
    return () => {
      set.delete(h)
      if (set.size === 0) this.listeners.delete(event)
    }
  }
}
