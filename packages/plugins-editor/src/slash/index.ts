import { injectPluginStyle } from '../style-inject'
import slashStyle from './style.css?inline'
/**
 * Slash 命令菜单（P1）
 *
 * 输入 → 唤起命令面板：标题/引用/代码块/分割线/列表/表格/图片/链接。
 * 基于官方 slashFactory + SlashProvider（floating-ui 定位）。
 */
import { slashFactory, SlashProvider } from '@milkdown/kit/plugin/slash'
import { computePosition, flip, offset, shift } from '@floating-ui/dom'
import { commandsCtx, editorViewCtx } from '@milkdown/kit/core'
import {
  headingSchema,
  blockquoteSchema,
  codeBlockSchema,
  hrSchema,
  bulletListSchema,
  orderedListSchema,
  listItemSchema,
  paragraphSchema,
  addBlockTypeCommand,
  clearTextInCurrentBlockCommand,
  selectTextNearPosCommand,
  setBlockTypeCommand,
  wrapInBlockTypeCommand,
} from '@milkdown/kit/preset/commonmark'
import { createTable } from '@milkdown/kit/preset/gfm'
import { imageBlockSchema } from '@milkdown/components/image-block'
import { TextSelection } from '@milkdown/prose/state'
import type { Node as PMNode } from '@milkdown/prose/model'
import { requestImage } from '../toolbar/command-bridge'
import type { MilkdownPlugin, Ctx } from '@milkdown/ctx'

interface SlashItem {
  /** 菜单显示文本 */
  label: string
  /** 图标（emoji） */
  icon: string
  hint: string
  /** 关键词匹配（/ 后输入过滤） */
  keywords: string[]
  /**
   * 执行：
   * - 'convert'：官方语义，转换「当前块」类型（clear+set / wrapIn / replaceSelectionWith）
   * - 'insert'：块句柄「+」插入模式——在 insertModeAt 位置插入指定类型的新块（选完才插入）
   */
  run: (ctx: Ctx, mode: 'convert' | 'insert') => void | Promise<void>
}

/** 插入模式的锚点位置（块句柄「+」点击后设置；null = 非插入模式） */
let insertModeAt: number | null = null

/** 在 insertModeAt 位置插入指定节点，光标进入新块（直接 schema.nodes.* 构造，绕开 milkdown 包装器） */
function insertBlockAt(ctx: Ctx, build: (schema: any, c: Ctx) => PMNode | null) {
  if (insertModeAt == null) return
  const view = ctx.get(editorViewCtx)
  const schema = view.state.schema
  const node = build(schema, ctx)
  if (!node) return
  let tr = view.state.tr.insert(insertModeAt, node)
  tr = tr.setSelection(TextSelection.near(tr.doc.resolve(insertModeAt + 1)))
  view.dispatch(tr.scrollIntoView())
}

const CN_NUM = ['一', '二', '三', '四', '五', '六']
/** 标题项（1-6 级统一构造） */
function headingItem(level: number): SlashItem {
  return {
    label: `标题 ${level}`,
    icon: `${level}️⃣`,
    hint: `${CN_NUM[level - 1]}级标题`,
    keywords: [`h${level}`, 'heading', '标题'],
    run: (ctx, mode) => {
      if (mode === 'insert') {
        insertBlockAt(ctx, (schema) => schema.nodes.heading.create({ level }))
        return
      }
      const cm = ctx.get(commandsCtx)
      cm.call(clearTextInCurrentBlockCommand.key)
      cm.call(setBlockTypeCommand.key, { nodeType: headingSchema.type(ctx), attrs: { level } })
    },
  }
}

function buildItems(): SlashItem[] {
  return [
    { label: '正文', icon: '📝', hint: '文本', keywords: ['text', 'paragraph', '正文'], run: (ctx, mode) => {
      if (mode === 'insert') {
        insertBlockAt(ctx, (schema) => schema.nodes.paragraph.create())
        return
      }
      const cm = ctx.get(commandsCtx)
      cm.call(clearTextInCurrentBlockCommand.key)
      cm.call(setBlockTypeCommand.key, { nodeType: paragraphSchema.type(ctx) })
    } },
    ...Array.from({ length: 6 }, (_, i) => headingItem(i + 1)),
    { label: '引用', icon: '💬', hint: '块引用', keywords: ['quote', 'blockquote', '引用'], run: (ctx, mode) => {
      if (mode === 'insert') {
        insertBlockAt(ctx, (schema) => schema.nodes.blockquote.createAndFill())
        return
      }
      const cm = ctx.get(commandsCtx)
      cm.call(clearTextInCurrentBlockCommand.key)
      cm.call(wrapInBlockTypeCommand.key, { nodeType: blockquoteSchema.type(ctx) })
    } },
    // 官方：code_block 非容器（content 为 line*），wrapIn 无效 → 用 setBlockType 替换块类型
    { label: '代码块', icon: '💻', hint: '程序代码', keywords: ['code', '代码'], run: (ctx, mode) => {
      if (mode === 'insert') {
        insertBlockAt(ctx, (schema) => schema.nodes.code_block.createAndFill())
        return
      }
      const cm = ctx.get(commandsCtx)
      cm.call(clearTextInCurrentBlockCommand.key)
      cm.call(setBlockTypeCommand.key, { nodeType: codeBlockSchema.type(ctx) })
    } },
    { label: '无序列表', icon: '▫️', hint: '列表', keywords: ['ul', 'bullet', '列表'], run: (ctx, mode) => {
      if (mode === 'insert') {
        insertBlockAt(ctx, (schema) => schema.nodes.bullet_list.createAndFill())
        return
      }
      const cm = ctx.get(commandsCtx)
      cm.call(clearTextInCurrentBlockCommand.key)
      cm.call(wrapInBlockTypeCommand.key, { nodeType: bulletListSchema.type(ctx) })
    } },
    { label: '有序列表', icon: '🔢', hint: '列表', keywords: ['ol', 'number', '列表'], run: (ctx, mode) => {
      if (mode === 'insert') {
        insertBlockAt(ctx, (schema) => schema.nodes.ordered_list.createAndFill())
        return
      }
      const cm = ctx.get(commandsCtx)
      cm.call(clearTextInCurrentBlockCommand.key)
      cm.call(wrapInBlockTypeCommand.key, { nodeType: orderedListSchema.type(ctx) })
    } },
    // 官方：hr 非容器 → addBlockType(replaceSelectionWith)
    { label: '分割线', icon: '➖', hint: '水平分隔', keywords: ['hr', 'divider', '分割'], run: (ctx, mode) => {
      if (mode === 'insert') {
        insertBlockAt(ctx, (schema) => schema.nodes.hr.create())
        return
      }
      const cm = ctx.get(commandsCtx)
      cm.call(clearTextInCurrentBlockCommand.key)
      cm.call(addBlockTypeCommand.key, { nodeType: hrSchema.type(ctx) })
    } },
    // 官方：clear → addBlockType(createTable) → selectTextNearPos
    { label: '表格', icon: '🗂️', hint: '3×3 表格', keywords: ['table', '表格'], run: (ctx, mode) => {
      if (mode === 'insert') {
        insertBlockAt(ctx, (_schema, c) => createTable(c, 3, 3))
        return
      }
      const cm = ctx.get(commandsCtx)
      const view = ctx.get(editorViewCtx)
      cm.call(clearTextInCurrentBlockCommand.key)
      const { from } = view.state.selection
      cm.call(addBlockTypeCommand.key, { nodeType: createTable(ctx, 3, 3) })
      cm.call(selectTextNearPosCommand.key, { pos: from })
    } },
    // 图片：独立块（image-block），URL 直链或本地文件上传后插入
    { label: '图片', icon: '🖼️', hint: '图片块', keywords: ['image', 'img', '图片', 'picture'], run: async (ctx, mode) => {
      const res = await requestImage({ title: '插入图片', confirmText: '插入' })
      if (!res || !res.src.trim()) return
      const src = res.src.trim()
      if (mode === 'insert') {
        insertBlockAt(ctx, (schema) => schema.nodes['image-block'].create({ src, caption: '' }))
        return
      }
      const cm = ctx.get(commandsCtx)
      cm.call(clearTextInCurrentBlockCommand.key)
      cm.call(addBlockTypeCommand.key, {
        nodeType: imageBlockSchema.type(ctx).create({ src, caption: '' }),
      })
    } },
  ]
}

/** 程序化显示控制器（对齐官方 Crepe menuAPI）：块句柄 "+" 点击后调 showAt(pos, anchor) */
let slashMenuController: { showAt: (pos: number, anchor?: HTMLElement, insertAt?: number) => void; hide: () => void } | null = null

/** 供外部（块句柄等）获取 slash 菜单控制器 */
export function getSlashMenu() {
  return slashMenuController
}

export const slashPlugin: MilkdownPlugin[] = (() => {
  const slash = slashFactory('slash-menu')

  const slashConfigPlugin: MilkdownPlugin = (ctx) => {
    const content = document.createElement('div')
    content.className = 'milkdown-slash'
    const items = buildItems()

    // 渲染菜单项（首次构建；过滤时更新显示）
    const rebuild = (filter: string) => {
      content.textContent = ''
      const kw = filter.toLowerCase()
      for (const item of items) {
        const matched =
          kw.length === 0 ||
          item.label.toLowerCase().includes(kw) ||
          item.keywords.some((k) => k.includes(kw))
        if (!matched) continue
        const row = document.createElement('button')
        row.type = 'button'
        row.className = 'slash-item'
        row.innerHTML =
          `<span class="slash-icon">${item.icon}</span><span class="slash-label">${item.label}</span><span class="slash-hint">${item.hint}</span>`
        row.addEventListener('mousedown', (e) => e.preventDefault())
        row.addEventListener('click', async () => {
          await item.run(ctx, insertModeAt != null ? 'insert' : 'convert')
          programmaticPos = null
          insertModeAt = null
          provider.hide()
        })
        content.appendChild(row)
      }
    }
    rebuild('')

    let provider: SlashProvider
    /** 程序化 show 的目标位置（对齐官方 programmaticallyPos）：null = 非 programmatic 模式 */
    let programmaticPos: number | null = null

    provider = new SlashProvider({
      content,
      shouldShow: (view) => {
        // 程序化模式：provider 不参与显示/定位（showAt 全权负责）；
        // 只负责越界检测——光标移出目标块外时撤旗
        if (programmaticPos != null) {
          // 插入模式：完全由 showAt 控制（插入不依赖光标位置，光标移走不撤旗）
          if (insertModeAt == null) {
            const maxSize = view.state.doc.nodeSize - 2
            const validPos = Math.min(programmaticPos, maxSize)
            const targetNode = view.state.doc.resolve(validPos).node()
            const currentNode = view.state.doc.resolve(view.state.selection.from).node()
            if (targetNode !== currentNode) {
              programmaticPos = null
              provider.hide()
            }
          }
          return false
        }
        const text = provider.getContent(view)
        return text != null && text.startsWith('/')
      },
    })

    // 最新 EditorView 引用（showAt 程序化定位需要）
    let latestView: Parameters<typeof provider.update>[0] | null = null

    // 暴露程序化控制器（块句柄 "+" 点击后调用 showAt）
    slashMenuController = {
      showAt: (pos: number, anchor?: HTMLElement, insertAt?: number) => {
        programmaticPos = pos
        insertModeAt = insertAt ?? null
        rebuild('')
        provider.show()
        // 官方 show() 只设 data-show 不定位；定位靠 update 循环，但 "+" 点击后的
        // dispatch 已结束、doc/selection 不再变化 → update 走 isSame 短路，不会重新定位。
        // 这里立即用 floating-ui 定位：有锚点（句柄 "+"）时贴着句柄 right-start 弹出，
        // 与官方 playground 观感一致；无锚点退回光标 bottom-start。
        if (!latestView) return
        const view = latestView
        let reference: Parameters<typeof computePosition>[0]
        let options: Parameters<typeof computePosition>[2]
        if (anchor) {
          reference = anchor
          // right-start：浮层左缘对齐句柄右缘、顶对齐；shift 防溢出视口；不用 flip（翻转后会盖住句柄另一侧，观感差）
          options = { placement: 'right-start', middleware: [offset(6), shift({ padding: 8 })] }
        } else {
          const coords = view.coordsAtPos(view.state.selection.from)
          reference = {
            getBoundingClientRect: () => ({
              x: coords.left, y: coords.top,
              top: coords.top, bottom: coords.bottom,
              left: coords.left, right: coords.right,
              width: 0, height: coords.bottom - coords.top,
              toJSON: () => ({}),
            }),
          }
          options = { placement: 'bottom-start', middleware: [flip(), offset(10)] }
        }
        computePosition(reference, provider.element, options)
          .then(({ x, y }) => {
            // floating-ui strategy:'absolute' 返回的坐标已相对 offsetParent，直接使用
            Object.assign(provider.element.style, { left: `${x}px`, top: `${y}px` })
          })
          .catch(console.error)
      },
      hide: () => {
        programmaticPos = null
        insertModeAt = null
        provider.hide()
      },
    }

    // 每次 update 时按输入过滤（保留 / 后的关键词）
    const originalUpdate = provider.update.bind(provider)
    provider.update = (view: Parameters<typeof provider.update>[0], prevState?: Parameters<typeof provider.update>[1]) => {
      originalUpdate(view, prevState)
      // 程序化模式关闭后同步清标志
      if (programmaticPos != null && provider.element.dataset.show !== 'true') {
        programmaticPos = null
        insertModeAt = null
      }
      if (provider.element.dataset.show === 'true' && programmaticPos == null) {
        const text = provider.getContent(view)
        if (text && text.startsWith('/')) {
          const kw = text.slice(1)
          rebuild(kw)
        }
      }
    }

    ctx.set(slash.key, {
      props: {
        handleDOMEvents: {
          keydown: (view, event) => {
            if (event.key === 'Escape' && provider.element.dataset.show === 'true') {
              programmaticPos = null
              insertModeAt = null
              provider.hide()
            }
            if (view.state.selection.empty && event.key === '/') {
              // 输入 / 时允许默认输入，provider 由 update 触发
            }
            return false
          },
          input: (view) => {
            provider.update(view)
            return false
          },
        },
      },
      view: (view) => {
        latestView = view
        provider.update(view)
        // 点击 slash 外部关闭（对齐 tooltip 行为）
        const onDocMouseDown = (e: MouseEvent) => {
          if (provider.element.dataset.show === 'true' && !content.contains(e.target as Node)) {
            // 插入模式 + 点击在弹窗（n-modal，如图片上传）内：保持菜单与锚点，异步请求完成后继续插入
            if (insertModeAt != null && (e.target as HTMLElement).closest?.('.n-modal')) return
            programmaticPos = null
            insertModeAt = null
            provider.hide()
          }
        }
        document.addEventListener('mousedown', onDocMouseDown)
        return {
          destroy: () => {
            document.removeEventListener('mousedown', onDocMouseDown)
            provider.destroy()
          },
        }
      },
    })

    return () => provider.destroy()
  }

  return [slash as unknown as MilkdownPlugin, slashConfigPlugin]
})()

export default slashPlugin
