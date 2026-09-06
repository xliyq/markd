import { describe, it, expect } from 'vitest'
import { parseOutline, countStats, toAnchor, headingPathAtLine } from '../doc-stats'

const SAMPLE = `# 一级标题

正文内容 **加粗** _斜体_ 带数字 123。

## 二级 A

- 列表项
- 另一个

### 三级 1

#### 四级

## 二级 B

结束
`

describe('parseOutline 大纲解析', () => {
  it('提取全部标题（层级/文本/行号）', () => {
    const outline = parseOutline(SAMPLE)
    expect(outline).toHaveLength(5)
    expect(outline[0]).toEqual({ level: 1, text: '一级标题', anchor: '一级标题', line: 1 })
    expect(outline[1]).toEqual({ level: 2, text: '二级 A', anchor: '二级-a', line: 5 })
    expect(outline[4]).toEqual({ level: 2, text: '二级 B', anchor: '二级-b', line: 14 })
  })

  it('锚点 GitHub 风格（小写/空格→-/去标点）', () => {
    expect(toAnchor('Hello, World!')).toBe('hello-world')
    expect(toAnchor('Three.js Guide')).toBe('threejs-guide')
    expect(toAnchor('含中文 标题')).toBe('含中文-标题')
  })
})

describe('countStats 字数统计', () => {
  it('统计中文/英文/字符/行数/标题数', () => {
    const s = countStats(SAMPLE)
    expect(s.cjkChars).toBeGreaterThan(0)
    expect(s.words).toBeGreaterThan(0)
    expect(s.lines).toBe(SAMPLE.split('\n').length)
    expect(s.headings).toBe(5)
  })
})

describe('headingPathAtLine 面包屑', () => {
  it('行号 → 当前标题路径', () => {
    const outline = parseOutline(SAMPLE)
    // 第 11 行（四级标题之前）→ 在「三级 1」下
    expect(headingPathAtLine(outline, 11)).toEqual(['一级标题', '二级 A', '三级 1'])
    // 第 12 行即「四级」标题行 → 包含四级
    expect(headingPathAtLine(outline, 12)).toEqual(['一级标题', '二级 A', '三级 1', '四级'])
    // 结尾在「二级 B」下
    expect(headingPathAtLine(outline, 15)).toEqual(['一级标题', '二级 B'])
    // 文档开头（标题行之前）
    expect(headingPathAtLine(outline, 1)).toEqual(['一级标题'])
  })
})
