/**
 * 图片（M4）—— 渲染层统一
 *
 * 所有插入路径（粘贴/拖拽/URL 直链/工具栏弹窗/文件选择器）最终都落到 image 节点或 image-block 节点，
 * 渲染层各自有 NodeView：本插件给标准 image 节点注册自定义 $view（figure + resize 手柄 + assets 解析），
 * 因此与插入方式彻底解耦——任何方式进来的图片都是同一形态；解析路径（remark）产出的 image-block 由官方组件渲染。
 */
import { upload } from '@milkdown/kit/plugin/upload'
import { imageBlockComponent } from '@milkdown/components/image-block'
import { imageUrlPaste } from './url-paste'
import { $view, $ctx, $prose } from '@milkdown/utils'
import { Plugin, NodeSelection } from '@milkdown/prose/state'
import { editorViewCtx } from '@milkdown/kit/core'
import { imageSchema } from '@milkdown/kit/preset/commonmark'
import type { Node as PMNode } from '@milkdown/prose/model'
import type { MilkdownPluginManifest } from '@editor/core'
import { injectPluginStyle } from '../style-inject'
import imageStyle from './style.css?inline'

/** 图片渲染配置（渲染层统一：assets 相对路径 → blob URL 由装配者注入） */
export const imageConfig = $ctx<
  { proxyDomURL?: (url: string) => Promise<string> | string },
  'imageConfigCtx'
>({}, 'imageConfigCtx')

/** 自定义 image NodeView：任何方式插入的 image 节点统一渲染为带 resize 手柄的图片块 */
export const imageNodeView = $view(imageSchema.node, (ctx) => (initialNode) => {
  const dom = document.createElement('figure')
  dom.className = 'milkdown-image'
  dom.contentEditable = 'false'
  const img = document.createElement('img')
  const handle = document.createElement('div')
  handle.className = 'image-resize-handle'
  // M4.5 加载状态：骨架占位 + 失败占位(含重试)
  const placeholder = document.createElement('div')
  placeholder.className = 'image-placeholder'
  placeholder.innerHTML = `<span class="image-placeholder-icon">🖼</span><span class="image-placeholder-text">加载中…</span>`
  const retryBtn = document.createElement('button')
  retryBtn.type = 'button'
  retryBtn.className = 'image-retry-btn'
  retryBtn.textContent = '↻ 重试'
  dom.append(placeholder, img, retryBtn, handle)

  // M4.3 属性编辑：选中时操作条 + 自绘浮层（alt/title 双输入）
  const actions = document.createElement('div')
  actions.className = 'image-actions'
  const attrBtn = document.createElement('button')
  attrBtn.type = 'button'
  attrBtn.className = 'image-attr-btn'
  attrBtn.title = '编辑图片属性（alt / title）'
  attrBtn.textContent = '⚙ 属性'
  actions.appendChild(attrBtn)
  const viewBtn = document.createElement('button')
  viewBtn.type = 'button'
  viewBtn.className = 'image-view-btn'
  viewBtn.title = '查看大图'
  viewBtn.textContent = '🔍 大图'
  actions.appendChild(viewBtn)
  dom.appendChild(actions)

  // 查看大图：派发自定义事件 → App 灯箱（单击保留给选中/属性，交互与官方一致）
  viewBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    window.dispatchEvent(
      new CustomEvent('milkdown:image-preview', { detail: { src: img.getAttribute('src') || '' } }),
    )
  })

  const popover = document.createElement('div')
  popover.className = 'image-attr-popover'
  popover.innerHTML = `
    <div class="image-attr-title">图片属性</div>
    <label class="image-attr-row"><span>alt</span><input class="image-attr-alt" placeholder="替代文本（无障碍）" /></label>
    <label class="image-attr-row"><span>title</span><input class="image-attr-title-input" placeholder="悬停标题" /></label>
    <div class="image-attr-btns">
      <button type="button" class="image-attr-cancel">取消</button>
      <button type="button" class="image-attr-ok">确定</button>
    </div>`
  dom.appendChild(popover)

  let attrOpen = false
  function openAttr() {
    const view = ctx.get(editorViewCtx)
    const sel = view.state.selection
    const node = sel instanceof NodeSelection && sel.node.type === initialNode.type ? sel.node : initialNode
    const altInput = popover.querySelector('.image-attr-alt') as HTMLInputElement
    const titleInput = popover.querySelector('.image-attr-title-input') as HTMLInputElement
    altInput.value = (node.attrs.alt as string) ?? ''
    titleInput.value = (node.attrs.title as string) ?? ''
    popover.classList.add('show')
    attrOpen = true
    altInput.focus()
  }
  function closeAttr() {
    popover.classList.remove('show')
    attrOpen = false
  }
  function saveAttr() {
    const view = ctx.get(editorViewCtx)
    const sel = view.state.selection
    const altInput = popover.querySelector('.image-attr-alt') as HTMLInputElement
    const titleInput = popover.querySelector('.image-attr-title-input') as HTMLInputElement
    if (sel instanceof NodeSelection && sel.node.type === initialNode.type) {
      const attrs = {
        ...sel.node.attrs,
        alt: altInput.value,
        title: titleInput.value,
      }
      view.dispatch(view.state.tr.setNodeMarkup(sel.$anchor.pos, null, attrs))
    }
    closeAttr()
  }
  attrBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    attrOpen ? closeAttr() : openAttr()
  })
  popover.querySelector('.image-attr-ok')!.addEventListener('click', (e) => { e.stopPropagation(); saveAttr() })
  popover.querySelector('.image-attr-cancel')!.addEventListener('click', (e) => { e.stopPropagation(); closeAttr() })
  const onDocMouseDown = (e: MouseEvent) => {
    if (attrOpen && !dom.contains(e.target as Node)) closeAttr()
  }
  const onDocKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && attrOpen) closeAttr()
  }
  document.addEventListener('mousedown', onDocMouseDown)
  document.addEventListener('keydown', onDocKeydown)

  const config = ctx.get(imageConfig.key)
  let currentSrc: string | null = null
  let failed = false
  function setSrc(src: string, force = false) {
    if (src === currentSrc && !force) return
    currentSrc = src
    failed = false
    dom.classList.remove('error')
    dom.classList.add('loading')
    placeholder.classList.remove('show')
    retryBtn.classList.remove('show')
    const resolved = config.proxyDomURL ? config.proxyDomURL(src) : src
    Promise.resolve(resolved).then((url) => {
      img.src = url
    })
  }
  // M4.7 懒加载：进入视口才真正加载（原生 loading=lazy）
  img.loading = 'lazy'
  img.addEventListener('load', () => {
    dom.classList.remove('loading', 'error')
    placeholder.classList.remove('show')
    retryBtn.classList.remove('show')
  })
  img.addEventListener('error', () => {
    dom.classList.remove('loading')
    dom.classList.add('error')
    placeholder.classList.add('show')
    placeholder.querySelector('.image-placeholder-text')!.textContent = '加载失败'
    retryBtn.classList.add('show')
  })
  retryBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    setSrc(currentSrc ?? '', true) // force：清失败态重新加载
  })
  function bindAttrs(node: PMNode) {
    setSrc(node.attrs.src as string)
    img.alt = (node.attrs.alt as string) ?? ''
    if (node.attrs.title) img.title = node.attrs.title as string
  }
  bindAttrs(initialNode)

  // resize：右下角拖拽（DOM 级；持久化 attrs 后续扩展）
  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const startW = img.clientWidth || img.naturalWidth || 300
    const startH = img.clientHeight || img.naturalHeight || 200
    const onMove = (ev: PointerEvent) => {
      img.style.width = `${Math.max(48, startW + (ev.clientX - startX))}px`
      img.style.height = `${Math.max(48, startH + (ev.clientY - startY))}px`
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  })

  return {
    dom,
    update: (updatedNode: PMNode) => {
      if (updatedNode.type !== initialNode.type) return false
      bindAttrs(updatedNode)
      return true
    },
    selectNode: () => dom.classList.add('selected'),
    deselectNode: () => dom.classList.remove('selected'),
    destroy: () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onDocKeydown)
      dom.remove()
    },
  }
})

/**
 * M4.7 大图懒加载：image-block（官方组件）的 img 补 loading="lazy"。
 * 原生 lazy 依赖 img 标签属性；官方组件不暴露，用 MutationObserver 给 DOM 里的 img 统一补。
 */
const lazyClass = 'milkdown-lazy-applied'
function applyLazy(root: ParentNode) {
  root
    .querySelectorAll<HTMLImageElement>('.milkdown-image-block img, .milkdown-image img')
    .forEach((im) => {
      if (!im.classList.contains(lazyClass)) {
        im.loading = 'lazy'
        im.classList.add(lazyClass)
      }
    })
}
const imageLazyPlugin = $prose((_ctx) => {
  return new Plugin({
    view: (view) => {
      applyLazy(view.dom)
      const mo = new MutationObserver(() => applyLazy(view.dom))
      mo.observe(view.dom, { childList: true, subtree: true })
      return { destroy: () => mo.disconnect() }
    },
  })
})

export const imageManifest: MilkdownPluginManifest = {
  id: 'image',
  type: 'milkdown',
  name: '图片',
  version: '1.0.0',
  description: '图片渲染（统一 resize 手柄）+ 粘贴/拖拽/URL 直链/文件选择器插入（M4）',
  dependsOn: ['commonmark'],
  defaultEnabled: true,
  create: () => {
    injectPluginStyle('image', imageStyle)
    // imageConfig 是 $ctx 插件，必须随组件注入（否则 imageConfigCtx 未注册，NodeView get 报 not found）
    return [...upload, imageUrlPaste, imageConfig, imageNodeView, imageLazyPlugin, ...imageBlockComponent]
  },
}
