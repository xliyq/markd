import { describe, it, expect } from 'vitest'
import katex from 'katex'

/**
 * S7 验证：KaTeX 离线渲染（M0.2 数学公式自研方案的基石）。
 * 核心：渲染产物完全本地（字体/CSS 随包发布），无 CDN/外部资源依赖。
 * 字体本地化已由独立的 Python 检查确认（60 个 woff2/woff/ttf 在包内 dist/fonts）。
 */

// 检查产物是否含外部资源引用（href/src 指向 http 或 //）
function hasExternalRef(html: string): boolean {
  return /(?:href|src)="(?:https?:|\/\/)/.test(html)
}

describe('S7 KaTeX 离线 spike', () => {
  it('行内公式渲染为 HTML（无外部 CDN 引用）', () => {
    const html = katex.renderToString('E = mc^2', { throwOnError: false })
    expect(html).toContain('katex')
    // xmlns 是 MathML 命名空间 URI（规范要求，非网络请求），允许出现
    expect(hasExternalRef(html)).toBe(false)
  })

  it('块级公式渲染（$$..$$ 场景）', () => {
    const html = katex.renderToString('\\int_0^\\infty x^2 dx', {
      throwOnError: false,
      displayMode: true,
    })
    expect(html).toContain('katex-display')
    expect(hasExternalRef(html)).toBe(false)
  })

  it('错误表达式安全（throwOnError: false 不抛异常）', () => {
    const html = katex.renderToString('\\invalid_command{', { throwOnError: false })
    expect(typeof html).toBe('string')
  })
})
