import { describe, it, expect, beforeEach } from 'vitest'
import { SearchManager, simpleHash } from '../search/manager'
import type { SearchDoc } from '../search/manager'

/**
 * ADR-016 全文搜索（MiniSearch）单测：
 * 索引构建/增量更新/搜索排序/摘要/序列化往返/同步差量。
 */

const mk = (id: string, name: string, body: string, hash = simpleHash(name + body)): SearchDoc => ({
  id, name, body, hash, updatedAt: 1,
})

describe('SearchManager', () => {
  let sm: SearchManager

  beforeEach(() => {
    sm = new SearchManager()
  })

  it('rebuild + 搜索命中并排序（标题权重高）', () => {
    sm.rebuild([
      mk('a', '苹果', '这是一个关于苹果种植的文档'),
      mk('b', '香蕉', '香蕉是一种水果，与苹果不同'),
      mk('c', '苹果派', '苹果派的做法需要苹果'),
    ])
    const hits = sm.search('苹果')
    expect(hits.length).toBeGreaterThanOrEqual(2)
    // 标题含「苹果」的排前面（权重 boost）
    expect(hits[0].id).toBe('a')
    expect(hits[0].name).toBe('苹果')
  })

  it('中文分词检索', () => {
    sm.rebuild([mk('d', '表格', '支持表格、图片等 GFM 语法')])
    const hits = sm.search('表格')
    expect(hits).toHaveLength(1)
    expect(hits[0].id).toBe('d')
  })

  it('增量 indexDoc / removeDoc', () => {
    sm.rebuild([mk('x', '甲', '内容一')])
    sm.indexDoc(mk('y', '乙', '内容二'))
    expect(sm.search('乙')).toHaveLength(1)
    sm.removeDoc('y')
    expect(sm.search('乙')).toHaveLength(0)
    expect(sm.search('甲')).toHaveLength(1)
  })

  it('syncWith 差量同步（增/改/删）', () => {
    sm.rebuild([mk('a', '旧', 'old content'), mk('b', '删', 'gone')])
    const r = sm.syncWith([
      mk('a', '新', 'new content', 'hash-changed'),
      mk('c', '新文档', 'fresh'),
    ])
    expect(r.removed).toBe(1) // b 删除
    expect(r.added).toBe(1)   // c 新增
    expect(r.updated).toBe(1) // a 更新
    expect(sm.size()).toBe(2)
  })

  it('摘要提取（含前后文省略号）', () => {
    sm.rebuild([mk('e', '长文', '第一段'.repeat(30) + '目标关键词' + '第二段'.repeat(30))])
    const hit = sm.search('目标关键词')[0]
    expect(hit.snippet).toContain('目标关键词')
    expect(hit.snippet.startsWith('…')).toBe(true)
  })

  it('序列化往返（持久化恢复）', () => {
    sm.rebuild([mk('p', '持久化', '内容')])
    const json = sm.toJSON()
    const sm2 = new SearchManager()
    sm2.fromJSON(json)
    expect(sm2.search('持久化')).toHaveLength(1)
    expect(sm2.size()).toBe(1)
  })

  it('空查询返回空', () => {
    sm.rebuild([mk('q', '标题', '内容')])
    expect(sm.search('  ')).toEqual([])
  })

  it('简单 hash 一致性', () => {
    expect(simpleHash('abc')).toBe(simpleHash('abc'))
    expect(simpleHash('abc')).not.toBe(simpleHash('abd'))
  })
})
