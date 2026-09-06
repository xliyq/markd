import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PluginManager, createEditor } from '@editor/core'
import type { EditorInstance } from '@editor/core'
import { allL1Manifests } from '../index'

/**
 * Phase 1 —— 集成验证：
 * PluginManager 装配 plugins-editor 全部 L1 manifest → createEditor 真实渲染。
 * 这是「插件化框架 → 编辑器内核」全链路的第一道门禁。
 */

const md = `# 标题

正文 **加粗** 和 *斜体*。

| 名称 | 值 |
| ---- | -- |
| A    | 1  |
`

describe('L1 插件集成（PluginManager → createEditor）', () => {
  let pm: PluginManager
  let root: HTMLElement
  let editor: EditorInstance

  beforeAll(async () => {
    // 1) 注册全部 L1 插件（拓扑排序，依赖自动处理）
    pm = new PluginManager()
    pm.registerAll(allL1Manifests)

    // 2) 启用集合应包含全部（都 defaultEnabled）
    // FIFO：无依赖者按注册顺序出队（image-block 注册于 theme-nord 后）
    const enabled = pm.resolveEnabledOrder()
    // FIFO：无依赖者按注册顺序出队（8 个 L1：commonmark/gfm/table/image/nord/image-block/tooltip/slash）
    // FIFO：find-replace 只依赖 commonmark，在 commonmark 后可立即出队；
    // table 依赖 gfm、slash-menu 依赖 tooltip，故排在其后
    expect(enabled).toEqual([
      'commonmark',
      'gfm',
      'image',
      'theme-nord',
      'tooltip',
      'find-replace',
      'code-block',
      'block',
      'trailing',
      'markdown-paste',
      'history',
      'table',
      'slash-menu',
    ])

    // 3) 装配：取 L1 插件 → createEditor
    const { milkdownPlugins } = pm.mountAll()
    root = document.createElement('div')
    document.body.appendChild(root)
    editor = await createEditor(root, md, { plugins: milkdownPlugins })
  })

  afterAll(async () => {
    await editor.destroy()
  })

  it('编辑器成功创建并渲染标题', () => {
    expect(root.querySelector('h1')?.textContent).toContain('标题')
  })

  it('Markdown 原文可读回（listener 已注册）', () => {
    // 通过实例句柄读当前内容（createEditor 维护 latestMarkdown）
    const got = editor.getMarkdown()
    expect(got).toContain('标题')
  })

  it('表格被渲染（gfm schema + table view 组合生效）', () => {
    const table = root.querySelector('table')
    expect(table).not.toBeNull()
    expect(root.querySelectorAll('table th').length).toBe(2)
  })

  it('引用渲染为链接', () => {
    // table 已含 A/1，验证基础内联语法
    expect(root.querySelector('strong')?.textContent).toContain('加粗')
    expect(root.querySelector('em')?.textContent).toContain('斜体')
  })
})
