/**
 * 应用层 API（AppApi）——L2 模块的注入边界
 *
 * 对齐 04 §4「暴露 API：向 L2 模块注入 AppApi（编辑器实例、store、storage、配置等）」。
 * L2 禁止直接 import milkdown，一切能力经此边界获得（02 §6 依赖规则）。
 *
 * 契约单一原则：storage 复用 core/data 的 StorageProvider（避免双接口漂移），
 * editor 复用 editor-factory 的 EditorInstance。
 */
import type { AnyPluginManifest } from './manifest'
import type { StorageProvider } from '../data/storage-provider'
import type { EditorInstance } from '../editor-factory'

/** AppApi：PluginManager 组装后注入每个 L2 模块 */
export interface AppApi {
  /** 已注册的全部 manifest（只读） */
  manifests: ReadonlyMap<string, AnyPluginManifest>
  /** 启用中的插件 id 集合 */
  enabledIds: ReadonlySet<string>
  /** 编辑器句柄（由装配者注入） */
  editor?: EditorInstance
  /** 存储抽象（由装配者注入，实现在 infra/dexie） */
  storage?: StorageProvider
  /** 读取某个插件的运行时配置 */
  getPluginConfig: <T = unknown>(id: string) => T | undefined
  /** 事件总线（简单发布订阅） */
  emit: <T = unknown>(event: string, payload?: T) => void
  on: <T = unknown>(event: string, handler: (payload: T) => void) => () => void
}

/** PluginManager 构造时注入（含装配者后补的 editor/storage） */
export interface AppApiSeed extends Partial<Pick<AppApi, 'editor' | 'storage'>> {
  manifests: ReadonlyMap<string, AnyPluginManifest>
  enabledIds: ReadonlySet<string>
  getPluginConfig: AppApi['getPluginConfig']
  emit: AppApi['emit']
  on: AppApi['on']
}
