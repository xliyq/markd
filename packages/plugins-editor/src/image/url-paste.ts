/**
 * URL 直链图片插入（M4.1：第四种插入方式）
 *
 * 粘贴纯文本 URL（http(s)）且命中常见图片扩展名 → 转 markdown `![alt](url)` → parser 插入 image 节点。
 * 非 URL / 非图片 URL → 返回 false（交还默认粘贴）。
 *
 * 注意与 plugin-upload 的 handlePaste 协调：upload 对无文件粘贴返回 false，此处不冲突。
 */
import { Plugin, PluginKey } from '@milkdown/prose/state'
import { $prose } from '@milkdown/utils'
import { schemaCtx } from '@milkdown/core'
import { Slice } from '@milkdown/prose/model'
import type { Ctx } from '@milkdown/ctx'

const key = new PluginKey('MILKDOWN_IMAGE_URL')

/** 图片 URL 识别：http(s) 或 // 协议相对 + 图片扩展名（支持查询串/锚点） */
export const IMAGE_URL_RE = /^(?:https?:\/\/|\/\/)[^\s]+(?:\.(png|jpe?g|gif|webp|svg|bmp|avif))([?#][^\s]*)?$/i

export function isImageUrl(text: string): boolean {
  return IMAGE_URL_RE.test(text.trim())
}

export const imageUrlPaste = $prose((ctx: Ctx) => {
  return new Plugin({
    key,
    props: {
      handlePaste: (view, event) => {
        const clipboardData = event.clipboardData
        if (!clipboardData) return false
        // URL 直链要求纯文本（无 HTML 表格/富文本）
        const html = clipboardData.getData('text/html')
        if (html && html.length > 0) return false
        const text = clipboardData.getData('text/plain').trim()
        if (!isImageUrl(text)) return false

        try {
          // 优先构造 image-block 节点（官方 NodeView：resize 手柄 + caption + 文件选择器）；
          // 未注册时退回标准 image 节点
          const schema = ctx.get(schemaCtx)
          const nodes = schema.nodes as unknown as Record<string, unknown>
          const imageBlockType = nodes['image-block'] as
            | { createAndFill: (attrs: Record<string, unknown>) => unknown }
            | undefined
          const node = imageBlockType
            ? imageBlockType.createAndFill({ src: text, caption: '', ratio: 1 })
            : (schema.nodes.image as unknown as { createAndFill: (a: Record<string, unknown>) => unknown })
                .createAndFill({ src: text, alt: '' })
          if (!node) return false
          view.dispatch(view.state.tr.replaceSelectionWith(node as never))
          return true
        } catch {
          return false
        }
      },
    },
  })
})
