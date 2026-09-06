/**
 * 浮动工具栏（P1：tooltip）
 *
 * 选中文本 → 浮动格式化按钮（粗/斜/行内代码/链接）。
 * 基于官方 tooltipFactory + TooltipProvider（floating-ui 定位）。
 * 命令经 commandsCtx 调用 commonmark 官方 toggle 命令。
 */
import { tooltipFactory, TooltipProvider } from '@milkdown/kit/plugin/tooltip'
import { bindCommands, requestText } from './command-bridge'
import { commandsCtx } from '@milkdown/kit/core'
import {
  toggleStrongCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleLinkCommand,
} from '@milkdown/kit/preset/commonmark'
import type { MilkdownPlugin } from '@milkdown/ctx'

/** 工具栏按钮定义（文字 + 命令工厂） */
interface ToolbarButton {
  label: string
  title: string
  command: (ctx: { get: (c: unknown) => { call: (payload?: unknown) => boolean } }) => void
}

const buttons: { label: string; title: string; key: string }[] = [
  { label: 'B', title: '加粗 (Ctrl+B)', key: 'toggleStrong' },
  { label: 'I', title: '斜体 (Ctrl+I)', key: 'toggleEmphasis' },
  { label: '`', title: '行内代码', key: 'toggleInlineCode' },
  { label: '🔗', title: '链接', key: 'toggleLink' },
]

export const tooltipPlugin: MilkdownPlugin[] = (() => {
  const tooltip = tooltipFactory('format-tooltip')
  // tooltipFactory 返回 [$Ctx, $Prose] 元组（带附加 key 属性），运行时合法，类型上断言为 MilkdownPlugin
  void tooltip

  /** 配置插件：挂 TooltipProvider + 自绘按钮组 */
  const tooltipConfigPlugin: MilkdownPlugin = (ctx) => {
    // 创建按钮容器
    const content = document.createElement('div')
    content.className = 'milkdown-tooltip'

    /** mousedown 时的选区（判断纯点击 vs 拖选） */
    let lastMouseDownSel: { from: number; to: number } | null = null

    const provider = new TooltipProvider({
      content,
      shouldShow: (view) => {
        const { doc, selection } = view.state
        const { empty, from, to } = selection
        // 空选区（仅光标）不显示
        if (empty || from === to) return false
        // 只有文本选区才显示——点击单元格/图片会产生 NodeSelection/CellSelection，
        // 此时选中了节点但文本框为空（或文本来自其他节点），不该弹格式化工具
        if (selection.constructor.name !== 'TextSelection') return false
        // 选中内容为空字符串（如双击空白单元格选中空段落）不显示
        if (!doc.textBetween(from, to).length) return false
        // 编辑器失焦 / 只读不显示
        if (!view.hasFocus()) return false
        if (!view.editable) return false
        return true
      },
    })

    // 注册命令桥（顶部工具栏共用同一 commandsCtx）。
    // CommandManager.call 的类型签名比桥接器更具体，用适配器收窄。
    bindCommands((key: unknown, payload?: unknown) =>
      (ctx.get(commandsCtx) as unknown as { call: (k: unknown, p?: unknown) => boolean }).call(key, payload),
    )

    // 按钮点击 → 命令
    const dispatchCommand = async (key: string) => {
      const commands = ctx.get(commandsCtx)
      if (key === 'toggleStrong') commands.call(toggleStrongCommand.key)
      else if (key === 'toggleEmphasis') commands.call(toggleEmphasisCommand.key)
      else if (key === 'toggleInlineCode') commands.call(toggleInlineCodeCommand.key)
      else if (key === 'toggleLink') {
        // 自绘输入框（替代 window.prompt）；取消/空输入 = 移除链接
        const url = await requestText({
          title: '插入链接',
          placeholder: 'https://…',
          confirmText: '确定',
        })
        if (url == null) return
        commands.call(toggleLinkCommand.key, url.trim() ? { href: url.trim() } : { href: '' })
      }
      provider.hide()
    }

    for (const b of buttons) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.textContent = b.label
      btn.title = b.title
      btn.className = 'tooltip-btn'
      btn.addEventListener('mousedown', (e) => e.preventDefault()) // 防失焦
      btn.addEventListener('click', () => dispatchCommand(b.key))
      content.appendChild(btn)
    }

    // 挂到 editorView：view 回调注册 provider.update
    ctx.set(tooltip.key, {
      props: {
        handleDOMEvents: {
          mousedown: (view) => {
            // 记录按下时选区：纯点击（选区未变化）不应重新弹出 tooltip
            lastMouseDownSel = {
              from: view.state.selection.from,
              to: view.state.selection.to,
            }
            return false
          },
          mouseup: (view) => {
            const sel = view.state.selection
            // 点击（mousedown→mouseup 选区未变，如点编辑器空白/点同一处）→ 隐藏，不重弹
            if (
              lastMouseDownSel &&
              sel.from === lastMouseDownSel.from &&
              sel.to === lastMouseDownSel.to
            ) {
              provider.hide()
              return false
            }
            provider.update(view)
            // 兜底：空选区强制隐藏
            if (sel.empty) provider.hide()
            return false
          },
        },
      },
      view: (view) => {
        provider.update(view)
        // 点击编辑器外部（非 tooltip 本身）→ 隐藏浮层。
        // milkdown 只监听 editorView 内 mouseup，点击容器空白/侧栏不会触发 update，
        // 导致 tooltip 残留。这里在 document 上补 mousedown 兜底。
        const onDocMouseDown = (e: MouseEvent) => {
          if (!content.contains(e.target as Node)) provider.hide()
        }
        // 兜底：任何位置 mouseup 时空选区 → 隐藏（点编辑器空白残留）
        const onDocMouseUp = () => {
          if (view.state.selection.empty) provider.hide()
        }
        document.addEventListener('mousedown', onDocMouseDown)
        document.addEventListener('mouseup', onDocMouseUp)
        return {
          destroy: () => {
            document.removeEventListener('mousedown', onDocMouseDown)
            document.removeEventListener('mouseup', onDocMouseUp)
            provider.destroy()
          },
        }
      },
    })

    return () => provider.destroy()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return [tooltip as unknown as MilkdownPlugin, tooltipConfigPlugin]
})()

export default tooltipPlugin
