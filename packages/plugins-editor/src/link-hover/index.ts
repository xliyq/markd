/**
 * 链接悬浮浮层（自研，替代官方 link-tooltip 的定位问题）
 *
 * 官方 link-tooltip 用 TooltipProvider + posToDOMRect reference 定位，在本项目环境中
 * 基准错乱（浮层掉到页面底部）。自研实现：悬浮链接 → fixed 定位浮层（视口基准，
 * reference 用链接 DOM 元素），提供 地址跳转 / 复制 / 编辑 / 删除。
 */
import { Plugin, PluginKey } from '@milkdown/prose/state'
import { $prose } from '@milkdown/utils'
import { computePosition, offset, shift } from '@floating-ui/dom'
import type { Mark } from '@milkdown/prose/model'
import type { Ctx } from '@milkdown/ctx'
import { requestText } from '../toolbar/command-bridge'

const key = new PluginKey('MILKDOWN_LINK_HOVER')

export const linkHover = $prose((_ctx: Ctx) => {
  return new Plugin({
    key,
    view: (view) => {
      const float = document.createElement('div')
      float.className = 'milkdown-link-hover'
      float.style.display = 'none'
      document.body.appendChild(float)

      let current: { mark: Mark; from: number; to: number; el: HTMLElement } | null = null
      let hideTimer: ReturnType<typeof setTimeout> | null = null

      /** 计算 link mark 覆盖范围（近似：含该 mark 的文本节点） */
      function findMarkRange(mark: Mark): { from: number; to: number } | null {
        let range: { from: number; to: number } | null = null
        view.state.doc.descendants((node, pos) => {
          if (range) return false
          for (const m of node.marks) {
            if (m.type === mark.type && m.attrs.href === mark.attrs.href) {
              range = { from: pos, to: pos + node.nodeSize }
              return false
            }
          }
          return true
        })
        return range
      }

      function hide() {
        if (hideTimer) clearTimeout(hideTimer)
        current = null
        float.style.display = 'none'
      }

      function render(a: HTMLAnchorElement, mark: Mark) {
        const range = findMarkRange(mark)
        if (!range) return
        current = { mark, from: range.from, to: range.to, el: a }
        const href = mark.attrs.href as string
        float.innerHTML = ''

        // 地址（点击新标签跳转）
        const link = document.createElement('a')
        link.className = 'lh-link'
        link.href = href
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        link.textContent = href
        float.appendChild(link)

        // 复制
        const copy = document.createElement('button')
        copy.type = 'button'
        copy.className = 'lh-btn'
        copy.textContent = '复制'
        copy.addEventListener('mousedown', (e) => e.preventDefault())
        copy.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(href)
            window.dispatchEvent(new CustomEvent('milkdown:link-copied', { detail: { link: href } }))
          } catch {
            /* 剪贴板不可用时静默 */
          }
        })
        float.appendChild(copy)

        // 编辑（改地址）
        const edit = document.createElement('button')
        edit.type = 'button'
        edit.className = 'lh-btn'
        edit.textContent = '编辑'
        edit.addEventListener('mousedown', (e) => e.preventDefault())
        edit.addEventListener('click', async () => {
          // 弹窗期间浮层可能被 hide（current 置空），用闭包捕获 from/to
          const saved = current
          const url = await requestText({
            title: '编辑链接',
            placeholder: 'https://…',
            initialValue: href,
            confirmText: '确定',
          })
          if (url == null || !saved) return
          const { from, to } = saved
          const tr = view.state.tr
            .removeMark(from, to, mark.type)
            .addMark(from, to, mark.type.create({ href: url.trim() }))
          view.dispatch(tr)
          hide()
        })
        float.appendChild(edit)

        // 删除（移除链接）
        const remove = document.createElement('button')
        remove.type = 'button'
        remove.className = 'lh-btn danger'
        remove.textContent = '删除'
        remove.addEventListener('mousedown', (e) => e.preventDefault())
        remove.addEventListener('click', () => {
          const saved = current
          if (!saved) return
          const { from, to } = saved
          view.dispatch(view.state.tr.removeMark(from, to, mark.type))
          hide()
        })
        float.appendChild(remove)

        float.style.display = 'flex'
        computePosition(a, float, {
          strategy: 'fixed',
          placement: 'top',
          middleware: [offset(8), shift({ padding: 8 })],
        }).then(({ x, y }) => {
          Object.assign(float.style, { left: `${x}px`, top: `${y}px` })
        })
      }

      /** 渲染层统一：遍历 doc 找 link mark（不依赖 posAtDOM/resolve.marks——
       *  posAtDOM 返回的位置可能不落在 mark 文本内（如 tooltip 入口的链接在段落中部）） */
      function findLinkMarkByHref(href: string): Mark | null {
        let mark: Mark | null = null
        view.state.doc.descendants((node) => {
          if (mark) return false
          const m = node.marks.find(
            (x) => x.type.name === 'link' && String(x.attrs.href) === href,
          )
          if (m) {
            mark = m
            return false
          }
          return true
        })
        return mark
      }

      // 悬浮链接 → 显示（先取消待执行的隐藏 timer：mouseout(旧元素) 可能在 mouseover 之后生效）
      const onMouseOver = (e: MouseEvent) => {
        const a = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null
        if (!a) return
        if (hideTimer) clearTimeout(hideTimer)
        // 渲染层统一：只要 a 是 link mark 渲染的，悬浮就生效，与插入入口无关
        const href = a.getAttribute('href') || ''
        const mark = findLinkMarkByHref(href)
        if (!mark) return
        render(a, mark)
      }
      // 移出链接 → 延迟隐藏（浮层 mouseenter 会取消，允许从链接移到浮层）
      const onMouseOut = (e: MouseEvent) => {
        if ((e.target as HTMLElement).closest('a')) return
        if (hideTimer) clearTimeout(hideTimer)
        hideTimer = setTimeout(hide, 220)
      }
      // 点击别处 → 隐藏
      const onDocMouseDown = (e: MouseEvent) => {
        if (!float.contains(e.target as Node)) hide()
      }

      view.dom.addEventListener('mouseover', onMouseOver)
      view.dom.addEventListener('mouseout', onMouseOut)
      document.addEventListener('mousedown', onDocMouseDown)
      float.addEventListener('mouseenter', () => {
        if (hideTimer) clearTimeout(hideTimer)
      })
      float.addEventListener('mouseleave', hide)

      return {
        destroy: () => {
          view.dom.removeEventListener('mouseover', onMouseOver)
          view.dom.removeEventListener('mouseout', onMouseOut)
          document.removeEventListener('mousedown', onDocMouseDown)
          float.remove()
        },
      }
    },
  })
})
