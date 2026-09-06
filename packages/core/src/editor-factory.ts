/**
 * 编辑器装配（正式版）
 *
 * 职责：把 PluginManager.mountAll() 输出的 L1 插件喂给 Milkdown 7.22 Editor.make()。
 * 与插件系统解耦：本模块不关心具体插件，只负责「装载 + 生命周期」。
 *
 * 链：PluginManager → createEditor({ plugins, onChange }) → Editor 实例
 *
 * 注：正式装配走 createEditor + PluginManager；
 *     createMinimalEditor 是 Phase 0 spike 的回归入口（内联默认插件集）。
 */
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, parserCtx } from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { gfm } from '@milkdown/kit/preset/gfm'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { tableBlock, tableBlockConfig } from '@milkdown/kit/component/table-block'
import { upload } from '@milkdown/kit/plugin/upload'
import { nord } from '@milkdown/theme-nord'
import type { MilkdownPlugin, Ctx } from '@milkdown/ctx'

/** 编辑器实例句柄（暴露给 L2 的最小接口） */
export interface EditorInstance {
  /** 当前 Markdown 原文 */
  getMarkdown: () => string
  /** 用 Markdown 原文整体替换文档内容（源码编辑回写；parser 解析后替换整篇，触发 onChange） */
  replaceMarkdown: (markdown: string) => void
  /** 滚动到指定文本的标题节点（大纲跳转；找到返回 true） */
  scrollToHeading: (text: string) => boolean
  /** 卸载并销毁（Milkdown destroy 返回 Promise<Editor>，对外吞掉） */
  destroy: () => Promise<void>
}

/** 公共：editor.action 内用 parser 整体替换文档（replaceMarkdown 实现体） */
function applyReplaceMarkdown(editor: import('@milkdown/kit/core').Editor, markdown: string): void {
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    const parser = ctx.get(parserCtx) as (md: string) => { content: unknown; type?: { name?: string } }
    const node = parser(markdown)
    const frag = (node as { content: unknown }).content
    view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, frag as never))
  })
}

/**
 * 图片上传处理函数（M4.2）：L2 存储策略注入点。
 * 对齐官方 uploader 契约（@milkdown/plugin-upload）：
 *   (files, schema, ctx, insertPos) => Promise<Fragment | Node | Node[]>
 * 用宽松泛型，L2 实现不必关心 milkdown 内部类型。
 */
export type EditorUploader = (
  files: FileList | File[],
  schema: unknown,
  ctx: unknown,
  insertPos: number,
) => Promise<unknown>

export interface CreateEditorOptions {
  /** PluginManager 输出的 L1 插件（已拓扑排序） */
  plugins: MilkdownPlugin[]
  /** Markdown 变更回调（供自动保存等 L2 使用） */
  onChange?: (markdown: string) => void
  /** 图片上传处理（L2 image-manager 注入的存储策略，T1/T2 挂载点） */
  uploader?: EditorUploader
}

/**
 * 创建编辑器实例（正式装配入口）。
 * 使用 Milkdown 7.22 链式 API（S1 验证）：
 *   Editor.make().config(ctx => ctx.set(rootCtx/defaultValueCtx)).use([...]).create()
 *
 * 说明：listener 插件由本厂内部注入（无论调用方插件列表是否含它），
 * 并用它把 markdown 变更接续到 latestMarkdown 与 onChange 回调。
 * （e2e 事故复盘：此前 onChange 未接线，自动保存从未收到内容变更）
 */
export async function createEditor(
  root: HTMLElement,
  defaultValue = '',
  options: CreateEditorOptions,
): Promise<EditorInstance> {
  // 动态 import 避免 core 对插件包的静态硬依赖
  const [{ listener, listenerCtx }, { uploadConfig }] = await Promise.all([
    import('@milkdown/kit/plugin/listener'),
    options.uploader ? import('@milkdown/kit/plugin/upload') : Promise.resolve({ uploadConfig: null as never }),
  ])

  let latestMarkdown = defaultValue

  const editor = await Editor.make()
    .config((ctx: Ctx) => {
      ctx.set(rootCtx, root)
      ctx.set(defaultValueCtx, defaultValue)
      // 注册 markdown 变更回调（autosave 等 L2 依赖此链路）
      ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
        latestMarkdown = markdown
        options.onChange?.(markdown)
      })
      // 图片上传策略注入（M4.2/核心：L2 返回 relPath 数组，core 构造 image node）
      if (options.uploader && uploadConfig) {
        const l2Uploader = options.uploader as (files: FileList | File[]) => Promise<string[]>
        const adapter = {
          // 适配官方 uploader 契约：(files, schema, ctx, insertPos) => Promise<Node[]>
          uploader: async (files: FileList, schema: { nodes: Record<string, unknown> }): Promise<unknown[]> => {
            const relPaths = await l2Uploader(files)
            const nodes = schema.nodes as unknown as Record<string, {
              createAndFill: (attrs: Record<string, unknown>) => unknown
            }>
            // 优先 image-block 节点（官方 NodeView：resize 手柄/caption）；退回标准 image
            const imageBlockType = nodes['image-block']
            return relPaths
              .map((src) =>
                imageBlockType
                  ? imageBlockType.createAndFill({ src, caption: '', ratio: 1 })
                  : nodes.image.createAndFill({ src, alt: '' }),
              )
              .filter(Boolean)
          },
        }
        ctx.set(uploadConfig.key, adapter as never)
      }
    })
    // listener 插件始终注入（onChange 依赖它），避免重复注入（同实例幂等）
    .use([...options.plugins, listener])
    .create()

  const scrollToHeading = (text: string): boolean =>
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      let found = false
      view.state.doc.descendants((node, pos) => {
        if (found) return false
        if (node.type.name === 'heading' && node.textContent === text) {
          found = true
          const dom = view.nodeDOM(pos) as HTMLElement | null
          dom?.scrollIntoView({ block: 'center', behavior: 'smooth' })
          return false
        }
      })
      return found
    })

  return {
    getMarkdown: () => latestMarkdown,
    replaceMarkdown: (markdown: string) => {
      latestMarkdown = markdown
      applyReplaceMarkdown(editor, markdown)
    },
    scrollToHeading,
    destroy: () => editor.destroy().then(() => undefined),
  }
}

/** nord 主题 (ctx)=>void → MilkdownPlugin 适配器 */
const nordThemePlugin: MilkdownPlugin = (ctx) => {
  nord(ctx)
  return () => {}
}

/**
 * Spike 回归入口（S3-S5 测试使用）。
 * 正式装配走 createEditor + PluginManager（插件由 plugins-editor 提供）。
 *
 * 注：这里用静态 import——core 插件应随应用启动一次性加载（S5 验证：首建 40ms 内）。
 * 动态懒加载只留给「按需启用」的可选插件（math/mermaid 等），由 PluginManager 决定。
 */
export async function createMinimalEditor(
  root: HTMLElement,
  defaultValue = '',
): Promise<EditorInstance> {
  let latestMarkdown = defaultValue

  const editor = await Editor.make()
    .config((ctx: Ctx) => {
      ctx.set(rootCtx, root)
      ctx.set(defaultValueCtx, defaultValue)
      // 表格按钮主题化（S3/S4 验证的注入点）
      ctx.set(tableBlockConfig.key, {
        renderButton: (t: string) => `<span data-type="${t}">${t}</span>`,
      })
      ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
        latestMarkdown = markdown
      })
    })
    .use([...commonmark, ...gfm, ...tableBlock, ...upload, listener, nordThemePlugin])
    .create()

  const scrollToHeading = (text: string): boolean =>
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      let found = false
      view.state.doc.descendants((node, pos) => {
        if (found) return false
        if (node.type.name === 'heading' && node.textContent === text) {
          found = true
          const dom = view.nodeDOM(pos) as HTMLElement | null
          dom?.scrollIntoView({ block: 'center', behavior: 'smooth' })
          return false
        }
      })
      return found
    })

  return {
    getMarkdown: () => latestMarkdown,
    replaceMarkdown: (markdown: string) => {
      latestMarkdown = markdown
      applyReplaceMarkdown(editor, markdown)
    },
    scrollToHeading,
    destroy: () => editor.destroy().then(() => undefined),
  }
}
