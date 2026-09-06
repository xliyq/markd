/**
 * 块级拖拽手柄（@milkdown/plugin-block + BlockProvider）
 *
 * 对齐官方 Crepe 行为：
 * 1. filterNodes 过滤掉 table/blockquote/math_inline 内的节点
 * 2. "+" 按钮在 grip 前面，句柄显示时始终可见
 * 3. 点击 "+" 插入段落后弹出 slash 菜单
 */
import { block, blockConfig, BlockProvider } from '@milkdown/plugin-block'
import type { MilkdownPlugin } from '@milkdown/ctx'
import type { EditorView } from '@milkdown/prose/view'
import { Plugin } from '@milkdown/prose/state'
import { $prose } from '@milkdown/utils'
import { findParent } from '@milkdown/prose'
import { getSlashMenu } from '../slash'
import type { MilkdownPluginManifest } from '@editor/core'
import { injectPluginStyle } from '../style-inject'
import blockStyle from './style.css?inline'

const HANDLE_CLASS = 'milkdown-block-handle'
const GRIP_CLASS = 'block-handle-grip'
const ADD_CLASS = 'block-handle-add'

// 六个点的 grip SVG
const GRIP_SVG = `<svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
  <circle cx="3" cy="2.5" r="1.5"></circle><circle cx="7" cy="2.5" r="1.5"></circle>
  <circle cx="3" cy="8" r="1.5"></circle><circle cx="7" cy="8" r="1.5"></circle>
  <circle cx="3" cy="13.5" r="1.5"></circle><circle cx="7" cy="13.5" r="1.5"></circle>
</svg>`

// plus icon SVG (对齐 Crepe 的 plusIcon)
const PLUS_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>`

let provider: BlockProvider | null = null

const blockConfigPlugin: MilkdownPlugin = (ctx) => {
  // 对齐 Crepe 的 filterNodes：过滤掉 table/blockquote/math_inline 内的节点
  ctx.update(blockConfig.key, (defaultConfig) => ({
    ...defaultConfig,
    filterNodes: (pos) => {
      const filter = findParent((node) =>
        ['table', 'blockquote', 'math_inline'].includes(node.type.name)
      )(pos)
      if (filter) return false
      return true
    },
  }))
  return () => {}
}

const blockViewPlugin: MilkdownPlugin = $prose((ctx) => {
  // 句柄 DOM：先 add 按钮，再 grip（对齐 Crepe component.tsx 的顺序）
  const handle = document.createElement('div')
  handle.className = HANDLE_CLASS
  handle.innerHTML = `
    <div class="${ADD_CLASS}" title="插入新块">${PLUS_ICON}</div>
    <div class="${GRIP_CLASS}" title="拖拽移动块">${GRIP_SVG}</div>
  `

  return new Plugin({
    view: (view: EditorView) => {
      if (!provider) {
        provider = new BlockProvider({
          ctx,
          content: handle,
          root: view.dom.parentElement ?? document.body,
          getPlacement: ({ active, blockDom }) => {
            // 对齐 Crepe 的定位逻辑
            if (active.node.type.name === 'heading') return 'left'
            let totalDescendant = 0
            active.node.descendants((node) => {
              totalDescendant += node.childCount
            })
            const dom = active.el
            const domRect = dom.getBoundingClientRect()
            const handleRect = blockDom.getBoundingClientRect()
            const style = window.getComputedStyle(dom)
            const paddingTop = Number.parseInt(style.paddingTop, 10) || 0
            const paddingBottom = Number.parseInt(style.paddingBottom, 10) || 0
            const height = domRect.height - paddingTop - paddingBottom
            const handleHeight = handleRect.height
            return totalDescendant > 2 || handleHeight < height ? 'left-start' : 'left'
          },
          getOffset: () => ({ mainAxis: 12, crossAxis: 0 }),
        })
        provider.update()

        // "+" 按钮点击（在 provider 初始化后绑定）
        const addBtn = handle.querySelector(`.${ADD_CLASS}`) as HTMLElement | null
        // pointerdown 添加 active class（对齐 Crepe）
        addBtn?.addEventListener('pointerdown', (e) => {
          e.preventDefault()
          addBtn.classList.add('active')
        })
        // pointerup 执行官方序列：插入空段落 → 隐藏句柄 → 程序化 show 菜单（选类型后原地转换）
        addBtn?.addEventListener('pointerup', (e) => {
          e.preventDefault()
          addBtn.classList.remove('active')
          if (!provider || !view.editable) return

          const active = provider.active
          if (!active) return
          if (!view.hasFocus()) view.focus()

          const pos = active.$pos.pos + active.node.nodeSize

          // 隐藏句柄
          provider.hide()

          // 程序化显示块类型菜单（插入模式：不预先插入，选完类型后才在 pos 插入对应新块）
          getSlashMenu()?.showAt(pos, addBtn, pos)
        }, { capture: true })
      }

      provider.update()

      return {
        destroy: () => {
          provider?.destroy()
          provider = null
        },
      }
    },
  })
})

export const blockManifest: MilkdownPluginManifest = {
  id: 'block',
  type: 'milkdown',
  name: '块级拖拽手柄',
  version: '1.0.0',
  description: '在块元素左侧显示可拖拽的六点句柄 + 插入菜单',
  dependsOn: ['commonmark'],
  defaultEnabled: true,
  create: () => {
    injectPluginStyle("block", blockStyle)
    return [...block, blockConfigPlugin, blockViewPlugin]
  },
}
