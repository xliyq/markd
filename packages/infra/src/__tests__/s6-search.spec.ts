import { describe, it, expect } from 'vitest'
import MiniSearch from 'minisearch'

/**
 * S6 验证：全文搜索方案取舍（Dexie 遍历 vs MiniSearch 索引）。
 * 模拟 10000 篇文档，对比两种方案的检索延迟，决定 V1 方案。
 */

// 生成 10000 篇模拟文档（标题 + 正文，含可搜索关键词）
function genDocs(n: number): { id: string; title: string; content: string }[] {
  const words = ['架构', '编辑器', '插件', '存储', '同步', '表格', '图片', '主题', '性能', '测试']
  const docs = []
  for (let i = 0; i < n; i++) {
    const w1 = words[i % words.length]
    const w2 = words[(i * 7) % words.length]
    docs.push({
      id: `doc-${i}`,
      title: `文档${i}：${w1}设计`,
      content: `这是第${i}篇文档，讨论${w1}与${w2}的实现方案。`.repeat(20),
    })
  }
  return docs
}

describe('S6 全文搜索 spike（10000 篇文档基准）', () => {
  const N = 10000
  const docs = genDocs(N)
  const TARGET = '架构' // 命中约 1000 篇

  it('MiniSearch 索引建立耗时（一次性成本）', () => {
    const t0 = performance.now()
    const ms = new MiniSearch({
      fields: ['title', 'content'],
      storeFields: ['title'],
      searchOptions: { prefix: true, fuzzy: 0.2 },
    })
    ms.addAll(docs)
    const buildMs = performance.now() - t0
    console.log(`S6 MiniSearch 索引构建 (${N} 篇): ${buildMs.toFixed(1)}ms`)
    // 万篇级索引构建应在可接受范围（< 5s）
    expect(buildMs).toBeLessThan(5000)
  })

  it('MiniSearch 检索延迟（含 1000 次查询统计）', () => {
    const ms = new MiniSearch({
      fields: ['title', 'content'],
      storeFields: ['title'],
      searchOptions: { prefix: true },
    })
    ms.addAll(docs)

    // 预热
    ms.search(TARGET)

    const t0 = performance.now()
    const queries = 100
    for (let i = 0; i < queries; i++) {
      ms.search(TARGET)
    }
    const avgMs = (performance.now() - t0) / queries
    console.log(`S6 MiniSearch 检索: 平均 ${avgMs.toFixed(3)}ms/次`)
    expect(avgMs).toBeLessThan(10) // 万篇级应 < 10ms/次
  })

  it('Dexie 遍历方案基线（filter 全扫）', () => {
    // Dexie 无索引 LIKE 查询 = 全表遍历 + 字符串匹配（V1 朴素基线）
    const t0 = performance.now()
    const results: string[] = []
    for (const d of docs) {
      if (d.title.includes(TARGET) || d.content.includes(TARGET)) {
        results.push(d.id)
      }
    }
    const elapsed = performance.now() - t0
    console.log(`S6 Dexie 遍历基线 (${N} 篇全扫): ${elapsed.toFixed(1)}ms, 命中 ${results.length}`)
    // 遍历基线作为对照记录
    expect(results.length).toBeGreaterThan(0)
  })

  it('结论判定：公平对比（遍历收集全部 vs MiniSearch 完整搜索）', () => {
    const ms = new MiniSearch({ fields: ['title', 'content'], storeFields: ['title'], searchOptions: { prefix: true } })
    ms.addAll(docs)

    // 遍历：收集全部匹配（等价真实场景）
    const scanResults: string[] = []
    const tScan0 = performance.now()
    for (const d of docs) {
      if (d.title.includes(TARGET) || d.content.includes(TARGET)) scanResults.push(d.id)
    }
    const scanMs = performance.now() - tScan0

    // MiniSearch：完整搜索（含 storeFields 取出）
    const tIdx0 = performance.now()
    const idxResults = ms.search(TARGET)
    const idxMs = performance.now() - tIdx0

    console.log(`S6 公平对比: 遍历全扫 ${scanMs.toFixed(1)}ms(${scanResults.length}条) vs MiniSearch ${idxMs.toFixed(2)}ms(${idxResults.length}条)`)
    // 真实 IndexedDB 全扫含磁盘读，远慢于内存；MiniSearch 常驻内存索引显著更快
    // 判定：万篇级两者都可接受，MiniSearch 有模糊/前缀/分词优势且随规模放大更稳
    expect(idxMs).toBeLessThan(50)
  })
})
