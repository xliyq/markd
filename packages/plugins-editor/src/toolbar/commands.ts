/**
 * 顶部工具栏命令封装（App.vue 只调字符串动作，不碰 @milkdown/kit 类型）
 *
 * 把 commonmark/gfm 官方命令 key 映射为语义化动作名，
 * 避免应用壳直接 import @milkdown/kit（保持依赖单向：apps → plugins-editor）。
 */
import {
  wrapInHeadingCommand,
  wrapInBlockquoteCommand,
  createCodeBlockCommand,
  insertHrCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  turnIntoTextCommand,
  toggleStrongCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  insertImageCommand,
} from '@milkdown/kit/preset/commonmark'
import { insertTableCommand } from '@milkdown/kit/preset/gfm'
import { runCommand, requestText, requestLink, requestImage } from './command-bridge'
import { insertLinkCommand } from '../tooltip'

export type ToolbarAction =
  | 'heading1' | 'heading2' | 'heading3' | 'paragraph'
  | 'bold' | 'italic' | 'code'
  | 'link' | 'image'
  | 'blockquote' | 'codeblock' | 'hr'
  | 'bulletList' | 'orderedList' | 'table'

/** 执行工具栏动作；link/image 会先弹自绘输入框。返回是否成功触发 */
export async function runToolbarAction(action: ToolbarAction): Promise<boolean> {
  switch (action) {
    case 'heading1': return runCommand(wrapInHeadingCommand.key, 1)
    case 'heading2': return runCommand(wrapInHeadingCommand.key, 2)
    case 'heading3': return runCommand(wrapInHeadingCommand.key, 3)
    case 'paragraph': return runCommand(turnIntoTextCommand.key)
    case 'bold': return runCommand(toggleStrongCommand.key)
    case 'italic': return runCommand(toggleEmphasisCommand.key)
    case 'code': return runCommand(toggleInlineCodeCommand.key)
    case 'blockquote': return runCommand(wrapInBlockquoteCommand.key)
    case 'codeblock': return runCommand(createCodeBlockCommand.key)
    case 'hr': return runCommand(insertHrCommand.key)
    case 'bulletList': return runCommand(wrapInBulletListCommand.key)
    case 'orderedList': return runCommand(wrapInOrderedListCommand.key)
    case 'table': return runCommand(insertTableCommand.key)
    case 'link': {
      // 双字段弹窗（文案 + 地址）：选中文本由 App 层预填；未选中时按输入文案插入链接
      const result = await requestLink({
        title: '插入链接',
        textLabel: '显示文案',
        urlLabel: '链接地址',
        initialText: '',
        confirmText: '确定',
      })
      if (!result || !result.href.trim()) return false
      return runCommand(insertLinkCommand.key, { text: result.text, href: result.href.trim() })
    }
    case 'image': {
      // URL 或本地文件上传（M4.1 文件选择器；上传后得到 assets/xxx 由渲染层 proxyDomURL 解析）
      const result = await requestImage({ title: '插入图片', confirmText: '插入' })
      if (!result || !result.src.trim()) return false
      return runCommand(insertImageCommand.key, { src: result.src.trim(), alt: '' })
    }
    default: return false
  }
}
