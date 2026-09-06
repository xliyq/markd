import { describe, it, expect } from 'vitest'
import { isImageUrl, IMAGE_URL_RE } from '../image/url-paste'

/**
 * M4.1 URL 直链识别单测：
 * 图片 URL（带扩展名）命中；普通 URL / 文本不误判。
 */

describe('isImageUrl 识别', () => {
  it('常见图片扩展名命中', () => {
    expect(isImageUrl('https://example.com/a.png')).toBe(true)
    expect(isImageUrl('https://example.com/a.jpg')).toBe(true)
    expect(isImageUrl('https://example.com/a.jpeg')).toBe(true)
    expect(isImageUrl('https://example.com/a.webp')).toBe(true)
    expect(isImageUrl('http://example.com/a.gif')).toBe(true)
    expect(isImageUrl('https://example.com/a.svg')).toBe(true)
  })

  it('带查询串/锚点命中', () => {
    expect(isImageUrl('https://example.com/a.png?size=100&x=1')).toBe(true)
    expect(isImageUrl('https://example.com/a.png#fragment')).toBe(true)
  })

  it('协议相对 URL（//）命中', () => {
    expect(isImageUrl('//cdn.example.com/a.png')).toBe(true)
  })

  it('非图片 URL 不误判', () => {
    expect(isImageUrl('https://example.com/page')).toBe(false)
    expect(isImageUrl('https://example.com/a.md')).toBe(false)
    expect(isImageUrl('https://example.com/a.pngx')).toBe(false)
  })

  it('非 URL / 空文本不误判', () => {
    expect(isImageUrl('hello world')).toBe(false)
    expect(isImageUrl('')).toBe(false)
    expect(isImageUrl('a.png')).toBe(false) // 无协议
  })

  it('正则可被引用（IMAGE_URL_RE 导出）', () => {
    expect(IMAGE_URL_RE).toBeInstanceOf(RegExp)
  })
})
