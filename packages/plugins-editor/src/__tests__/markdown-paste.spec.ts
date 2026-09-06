import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createEditor, type EditorInstance } from '@editor/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { gfm } from '@milkdown/kit/preset/gfm'
import { looksLikeMarkdown, markdownPaste } from '../markdown-paste'

describe('looksLikeMarkdown 判定', () => {
  it('标题', () => expect(looksLikeMarkdown('## 粘贴标题')).toBe(true))
  it('无序列表', () => expect(looksLikeMarkdown('- 项目一\n- 项目二')).toBe(true))
  it('有序列表', () => expect(looksLikeMarkdown('1. 第一步\n2. 第二步')).toBe(true))
  it('代码围栏', () => expect(looksLikeMarkdown('```js\nconst a = 1\n```')).toBe(true))
  it('引用', () => expect(looksLikeMarkdown('> 引用一句')).toBe(true))
  it('分割线', () => expect(looksLikeMarkdown('---')).toBe(true))
  it('GFM 表格', () => expect(looksLikeMarkdown('| a | b |\n|---|---|\n| 1 | 2 |')).toBe(true))
  it('普通文本 → false', () => expect(looksLikeMarkdown('这是一段普通文本，没有任何标记。')).toBe(false))
  it('单行 URL → false（交还 url-paste）', () => expect(looksLikeMarkdown('https://example.com/a.png')).toBe(false))
  it('空文本 → false', () => expect(looksLikeMarkdown('  ')).toBe(false))
})

describe('粘贴解析集成', () => {
  let root: HTMLElement
  let editor: EditorInstance | null = null

  beforeAll(async () => {
    root = document.createElement('div')
    document.body.appendChild(root)
    editor = await createEditor(root, '', {
      plugins: [...commonmark, ...gfm, markdownPaste],
    })
  })

  afterAll(async () => {
    await editor?.destroy()
    root.remove()
  })

  // happy-dom 合成 ClipboardEvent 不触发 ProseMirror 内部监听（skill 记录），
  // 粘贴链路由 Playwright 真实浏览器 e2e 验证（apps/editor）。
  it.skip('粘贴 "## 标题" → 解析为标题（getMarkdown 不再含字面 ##）', async () => {
    if (typeof DataTransfer === 'undefined' || typeof ClipboardEvent === 'undefined') {
      // happy-dom 无 DataTransfer 时跳过集成（纯函数判定已覆盖）
      expect(true).toBe(true)
      return
    }
    const dt = new DataTransfer()
    dt.setData('text/plain', '## 粘贴标题')
    const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })
    root.querySelector('.ProseMirror')?.dispatchEvent(ev)
    await new Promise((r) => setTimeout(r, 120))
    const md = editor!.getMarkdown()
    expect(md).toContain('粘贴标题')
    expect(md).not.toContain('## 粘贴标题')
  })
})
