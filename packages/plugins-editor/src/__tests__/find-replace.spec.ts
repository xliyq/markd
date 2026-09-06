import { describe, it, expect } from 'vitest'
import {
  findAllMatches,
  replaceAllMatches,
  stepMatchIndex,
  escapeRegExp,
} from '../find-replace/find'

describe('findAllMatches 定位', () => {
  it('命中全部非重叠匹配', () => {
    const r = findAllMatches('foo bar foo baz foo', 'foo')
    expect(r).toEqual([
      { from: 0, to: 3 },
      { from: 8, to: 11 },
      { from: 16, to: 19 },
    ])
  })

  it('大小写不敏感默认', () => {
    const r = findAllMatches('Foo foo FOO', 'foo')
    expect(r).toHaveLength(3)
  })

  it('大小写敏感可选', () => {
    const r = findAllMatches('Foo foo FOO', 'foo', { caseInsensitive: false })
    expect(r).toHaveLength(1)
    expect(r[0].from).toBe(4)
  })

  it('中文匹配', () => {
    const r = findAllMatches('表格和图片，表格优先', '表格')
    expect(r).toHaveLength(2)
  })

  it('空查询/无匹配返回空', () => {
    expect(findAllMatches('abc', '')).toEqual([])
    expect(findAllMatches('abc', 'zzz')).toEqual([])
  })

  it('正则特殊字符按字面处理', () => {
    const r = findAllMatches('a.b a.b', 'a.b')
    expect(r).toHaveLength(2) // 转义后匹配字面量，而非任意字符
  })
})

describe('replaceAllMatches 替换', () => {
  it('全部替换（从后往前防漂移）', () => {
    expect(replaceAllMatches('foo x foo', findAllMatches('foo x foo', 'foo'), 'bar'))
      .toBe('bar x bar')
  })

  it('空匹配列表原样返回', () => {
    expect(replaceAllMatches('foo', [], 'bar')).toBe('foo')
  })
})

describe('stepMatchIndex 导航', () => {
  it('循环 next/prev', () => {
    expect(stepMatchIndex(-1, 3, 'next')).toBe(0)
    expect(stepMatchIndex(0, 3, 'next')).toBe(1)
    expect(stepMatchIndex(2, 3, 'next')).toBe(0)
    expect(stepMatchIndex(0, 3, 'prev')).toBe(2)
    expect(stepMatchIndex(-1, 3, 'prev')).toBe(2)
  })

  it('零匹配返回 -1', () => {
    expect(stepMatchIndex(-1, 0, 'next')).toBe(-1)
  })
})

describe('escapeRegExp', () => {
  it('转义全部特殊字符', () => {
    expect(escapeRegExp('a.b*c')).toBe('a\\.b\\*c')
  })
})
