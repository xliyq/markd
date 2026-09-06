/**
 * 表格数据交换插件（M5.5）
 *
 * handlePaste 拦截：剪贴板 text/plain 是 Excel（TSV）/CSV 表格数据时，
 * 转成 GFM 表格语法 → 走 Milkdown parser → 插入真实表格节点。
 * 非表格数据返回 false（交还给默认粘贴流程）。
 *
 * 依赖：parserCtx（Milkdown markdown parser），与 @milkdown/plugin-clipboard 协同。
 */
import { Plugin, PluginKey } from '@milkdown/prose/state'
import { $prose } from '@milkdown/utils'
import { parserCtx } from '@milkdown/core'
import { Slice } from '@milkdown/prose/model'
import type { Ctx } from '@milkdown/ctx'
import { detectAndConvertTable } from './convert'

const key = new PluginKey('MILKDOWN_TABLE_EXCHANGE')

export const tableExchange = $prose((ctx: Ctx) => {
  return new Plugin({
    key,
    props: {
      handlePaste: (view, event) => {
        const clipboardData = event.clipboardData
        if (!clipboardData) return false

        // 有 HTML（网页表格复制）→ 交还默认（clipboard 插件走 HTML 解析）
        const html = clipboardData.getData('text/html')
        if (html && html.length > 0) return false

        const text = clipboardData.getData('text/plain')
        const result = detectAndConvertTable(text)
        if (!result) return false

        // 转成 markdown 表格 → parser 解析为节点 → 替换选区
        const parser = ctx.get(parserCtx) as (text: string) => { content: { content: unknown } }
        const node = parser(result.markdown) as unknown as { content: { content: unknown } }
        if (!node) return false

        try {
          // parser 返回文档节点，node.content 即文档 Fragment；Slice 包裹替换选区
          // （旧写法 replaceSelection(node.content.content) 是 Node[]，真实粘贴会 lastChild 崩溃）
          const fragment = node.content as never
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

export { detectAndConvertTable, tableToMarkdown } from './convert'
