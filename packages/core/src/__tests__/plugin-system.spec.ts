import { describe, it, expect } from 'vitest'
import {
  topoSort,
  CircularDependencyError,
  MissingDependencyError,
} from '../plugin-system/topology'
import { PluginManager } from '../plugin-system/plugin-manager'
import type { MilkdownPluginManifest, AppModuleManifest } from '../plugin-system/manifest'

/**
 * Phase 1 —— 插件系统单测：
 * 拓扑排序正确性、循环/缺失依赖检测、PluginManager 启停与挂载。
 */

describe('topology 拓扑排序', () => {
  it('按依赖顺序排序（被依赖者在前）', () => {
    const order = topoSort([
      { id: 'b', dependsOn: ['a'] },
      { id: 'c', dependsOn: ['b'] },
      { id: 'a', dependsOn: [] },
    ] as any[])
    expect(order).toEqual(['a', 'b', 'c'])
  })

  it('无依赖时保持注册顺序稳定（FIFO，非字母序）', () => {
    const order = topoSort([
      { id: 'zeta', dependsOn: [] },
      { id: 'alpha', dependsOn: [] },
      { id: 'mid', dependsOn: [] },
    ] as any[])
    // 无依赖关系时按注册先后装载
    expect(order).toEqual(['zeta', 'alpha', 'mid'])
  })

  it('检测循环依赖', () => {
    expect(() =>
      topoSort([
        { id: 'a', dependsOn: ['c'] },
        { id: 'b', dependsOn: ['a'] },
        { id: 'c', dependsOn: ['b'] },
      ] as any[]),
    ).toThrow(CircularDependencyError)
  })

  it('检测未声明的依赖', () => {
    expect(() => topoSort([{ id: 'a', dependsOn: ['ghost'] }] as any[])).toThrow(
      MissingDependencyError,
    )
  })
})

describe('PluginManager 插件管理中心', () => {
  const milkdownManifest = (id: string, dependsOn: string[] = [], enabled = true): MilkdownPluginManifest => ({
    id,
    type: 'milkdown',
    name: id,
    version: '0.0.1',
    description: '',
    dependsOn,
    defaultEnabled: enabled,
    create: () => () => () => {},
  })

  const appManifest = (id: string, dependsOn: string[] = [], enabled = true): AppModuleManifest => ({
    id,
    type: 'app',
    name: id,
    version: '0.0.1',
    description: '',
    dependsOn,
    defaultEnabled: enabled,
    mount: () => ({ name: id }),
  })

  it('注册后 resolveEnabledOrder 按拓扑 + 启用过滤', () => {
    const pm = new PluginManager()
    pm.register(
      milkdownManifest('gfm', ['commonmark']),
      appManifest('document-tree'),
      milkdownManifest('commonmark'),
    )
    // 注册顺序：gfm(1) → document-tree(2) → commonmark(3)
    // document-tree 与 commonmark 均无依赖 → 按注册顺序先出；gfm 依赖 commonmark → 最后
    expect(pm.resolveEnabledOrder()).toEqual(['document-tree', 'commonmark', 'gfm'])
  })

  it('setEnabled 覆盖 defaultEnabled（关闭某插件）', () => {
    const pm = new PluginManager()
    pm.register(
      milkdownManifest('gfm', ['commonmark']),
      milkdownManifest('commonmark'),
    )
    pm.setEnabled('gfm', false)
    expect(pm.resolveEnabledOrder()).toEqual(['commonmark'])
  })

  it('mountAll 返回 L1 插件列表 + L2 模块句柄', () => {
    const pm = new PluginManager()
    const mounted: string[] = []
    pm.register(
      {
        ...appManifest('doc-tree'),
        mount: () => {
          mounted.push('doc-tree')
          return { name: '文档树' }
        },
      },
      milkdownManifest('commonmark'),
    )
    const result = pm.mountAll()
    expect(result.milkdownPlugins.length).toBe(1)
    expect(result.appModules.map((m) => m.id)).toEqual(['doc-tree'])
    expect(mounted).toEqual(['doc-tree'])
  })

  it('重复注册抛 DuplicatePluginError', () => {
    const pm = new PluginManager()
    pm.register(milkdownManifest('x'))
    expect(() => pm.register(milkdownManifest('x'))).toThrow(/already registered/)
  })

  it('事件总线 emit/on/取消', () => {
    const pm = new PluginManager()
    const seen: string[] = []
    const off = pm.on<string>('doc:changed', (id) => seen.push(id))
    pm.emit('doc:changed', 'doc-1')
    pm.emit('doc:changed', 'doc-2')
    off()
    pm.emit('doc:changed', 'doc-3')
    expect(seen).toEqual(['doc-1', 'doc-2'])
  })

  it('inject 注入 editor/storage 后 L2 模块可获取', () => {
    const pm = new PluginManager()
    let captured: unknown
    const mod: AppModuleManifest = {
      ...appManifest('capture-deps'),
      mount: (api) => {
        captured = { editor: api.editor, storage: api.storage }
        return { name: '捕获依赖' }
      },
    }
    pm.register(mod)
    // 注入前 mount → 捕获到 undefined
    pm.mountAll()
    expect(captured).toEqual({ editor: undefined, storage: undefined })

    // 注入后 mount → 捕获到实例
    const fakeEditor = { getMarkdown: () => 'x', destroy: async () => {} }
    const fakeStorage = { listChildren: async () => [] }
    pm.inject({ editor: fakeEditor as never, storage: fakeStorage as never })
    pm.mountAll()
    expect(captured).toEqual({ editor: fakeEditor, storage: fakeStorage })
  })

  it('getSettingsSchema 聚合 configSchema（无 schema 的插件被过滤）', () => {
    const pm = new PluginManager()
    pm.register({
      ...milkdownManifest('with-config'),
      configSchema: { enableX: { type: 'boolean', default: true } },
    })
    pm.register(milkdownManifest('no-config'))
    const schemas = pm.getSettingsSchema()
    // no-config 无 configSchema，按设计不进入设置表单
    expect(schemas.map((s) => s.id)).toEqual(['with-config'])
    expect(schemas[0]?.schema).toEqual({ enableX: { type: 'boolean', default: true } })
  })
})
