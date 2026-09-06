/**
 * Markdown 粘贴解析（Typora 式体验）
 *
 * 直接复制 Markdown 源文本（如从 GitHub/Typora/CSDN 复制）粘贴时，
 * 默认行为是当纯文本插入（"## 标题" 显示为文本）。本插件拦截：
 * 剪贴板为纯文本（无 HTML）且含块级 Markdown 语法 → 用 markdown parser 解析为节点替换选区。
 *
 * 与 table-exchange（Excel/CSV → 表格）分工：它认 TSV/CSV，本插件认 GFM 语法（含 "| a | b |" 表格）；
 * 与 url-paste（图片 URL）分工：单行 URL 非块级语法，交还给它。
 */
import { Plugin, PluginKey } from '@milkdown/prose/state'
import { Fragment, Slice } from '@milkdown/prose/model'
import { $prose } from '@milkdown/utils'
import { parserCtx } from '@milkdown/core'
import type { Ctx } from '@milkdown/ctx'
import type { MilkdownPluginManifest } from '@editor/core'

const key = new PluginKey('MILKDOWN_MARKDOWN_PASTE')

/** 行首块级 markdown 语法（标题/列表/引用/围栏/分割线/表格行） */
const BLOCK_LINE_RE =
  /^\s{0,3}(#{1,6}[ \t]|[-*+][ \t]|\d+[.)][ \t]|>[ \t]?|```|~~~|[-*_]{3,}[ \t]*$|\|.+\|)/
/** 围栏代码块（整段） */
const FENCE_RE = /^\s{0,3}(```|~~~)/
/** GFM 表格（至少表头 + 分隔行） */
const TABLE_RE = /^\s{0,3}\|.+\|\s*$/

export function looksLikeMarkdown(text: string): boolean {
  if (!text || !text.trim()) return false
  const lines = text.split('\n')
  if (FENCE_RE.test(text)) return true
  // 表格：≥2 行且含分隔行
  if (text.includes('\n') && lines.filter((l) => TABLE_RE.test(l)).length >= 2) return true
  return lines.some((l) => BLOCK_LINE_RE.test(l))
}

export const markdownPaste = $prose((ctx: Ctx) => {
  return new Plugin({
    key,
    props: {
      handlePaste: (view, event) => {
        const clipboardData = event.clipboardData
        if (!clipboardData) return false
        // 有 HTML（网页复制）→ 交还默认（clipboard 插件走 HTML 解析）
        const html = clipboardData.getData('text/html')
        if (html && html.trim().length > 0) return false

        const text = clipboardData.getData('text/plain')
        if (!text || !text.trim()) return false
        if (!looksLikeMarkdown(text)) return false

        const parser = ctx.get(parserCtx) as (md: string) => {
          content: { content: unknown }
        }
        let node: ReturnType<typeof parser> | null = null
        try {
          node = parser(text)
        } catch {
          // 解析失败交还默认粘贴
        }
        if (!node) return false

        try {
          // node.content 即文档 Fragment；Slice(fragment, 0, 0) 包裹替换选区
          const fragment = (node as unknown as { content: Fragment }).content
          const slice = new Slice(fragment, 0, 0)
          view.dispatch(view.state.tr.replaceSelection(slice))
          return true
        } catch {
          return false
        }
      },
    },
  })
})

export const markdownPasteManifest: MilkdownPluginManifest = {
  id: 'markdown-paste',
  type: 'milkdown',
  name: 'Markdown 粘贴解析',
  version: '1.0.0',
  description: '复制 Markdown 源文本粘贴时解析为格式（标题/列表/代码块/表格，Typora 式）',
  dependsOn: ['commonmark'],
  defaultEnabled: true,
  create: () => markdownPaste,
}
