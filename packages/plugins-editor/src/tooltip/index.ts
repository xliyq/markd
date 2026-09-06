/**
 * 浮动工具栏 manifest（P1）
 */
import { tooltipPlugin } from '../toolbar/tooltip'
import { $command } from '@milkdown/utils'
import { editorViewCtx } from '@milkdown/kit/core'
import { linkHover } from '../link-hover'
import type { MilkdownPluginManifest } from '@editor/core'
import { injectPluginStyle } from '../style-inject'
import tooltipStyle from './style.css?inline'

/** 插入链接命令：选中且文案未改 → 给选区加 link mark；否则（含未选中）替换为链接文本 */
export const insertLinkCommand = $command<
  { text: string; href: string },
  'InsertLink'
>('InsertLink', (_ctx) => (payload) => {
  // 返回 ProseMirror Command：(state, dispatch) => boolean
  return (state, dispatch) => {
    if (!payload) return false
    const linkType = state.schema.marks.link
    if (!linkType) return false
    const { from, to } = state.selection
    const selectedText = state.doc.textBetween(from, to, '')
    if (to > from && payload.text === selectedText) {
      dispatch?.(state.tr.addMark(from, to, linkType.create({ href: payload.href })))
      return true
    }
    // 未选中 / 文案改动 → 替换为链接文本
    const text = payload.text.trim() || payload.href
    const mark = linkType.create({ href: payload.href })
    const node = state.schema.text(text, [mark])
    dispatch?.(state.tr.insert(state.selection.from, node))
    return true
  }
})

export const tooltipManifest: MilkdownPluginManifest = {
  id: 'tooltip',
  type: 'milkdown',
  name: '浮动工具栏',
  version: '1.0.0',
  description: '选中文本浮动格式化按钮（粗/斜/代码/链接）',
  dependsOn: ['commonmark'],
  defaultEnabled: true,
  create: () => {
    injectPluginStyle("tooltip", tooltipStyle)
    return [...tooltipPlugin, insertLinkCommand, linkHover]
  },
}
