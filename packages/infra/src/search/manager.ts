/**
 * 全文搜索（ADR-016：MiniSearch）
 *
 * 包模型：每篇文档 = 1 条 index entry
 *   { id: docId, name, body, hash, updatedAt }
 * - 检索字段：name（权重 2）+ body（权重 1）
 * - 持久化：索引 JSON 序列化的字符串存 settings（key='search.index.v1'）
 *   （V1 不建独立表；doc 数 < 1 万 settings KV 够用）
 * - 增量更新：searchManager.indexDoc / removeDoc 触发 setIndex
 * - 启动校验：扫描所有 docs，与索引条目 hash 对比 → 不一致则 reindex
 */
import MiniSearch from 'minisearch'

export interface SearchDoc {
  id: string
  name: string
  body: string
  hash: string
  updatedAt: number
}

export interface SearchHit {
  id: string
  name: string
  /** 命中摘要（高亮前后文） */
  snippet: string
  /** MiniSearch 评分 */
  score: number
}

const INDEX_KEY = 'search.index.v1'

function simpleHash(s: string): string {
  // 简单 hash（FNV-1a 风格），仅用于变更检测，不要求密码学强度
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = (h * 0x01000193) >>> 0
  }
  return h.toString(36)
}

/** 中英文混合分词：英文按单词，中文按单字（V1 简化，够用即可） */
export function tokenize(text: string): string[] {
  // 英文/数字词 + 中文单字
  const tokens = text.match(/[\w]+|[\u4e00-\u9fa5]/g) ?? []
  return tokens.map((t) => t.toLowerCase())
}

export class SearchManager {
  private mini: MiniSearch<SearchDoc>
  private dirty = false
  /** 自维护的已索引 id 集合（MiniSearch 无公开遍历 API） */
  private docs = new Map<string, SearchDoc>()

  constructor() {
    this.mini = new MiniSearch<SearchDoc>({
      fields: ['name', 'body'],
      storeFields: ['name', 'body', 'updatedAt'],
      tokenize,
      processTerm: (t) => t.toLowerCase(),
      searchOptions: {
        boost: { name: 2 },
        fuzzy: 0.2,
        prefix: true,
      },
    })
  }

  /** 重建索引（全量；文档量大时慎用） */
  rebuild(docs: SearchDoc[]): void {
    this.mini.removeAll()
    this.docs = new Map(docs.map((d) => [d.id, d]))
    this.mini.addAll(docs)
    this.dirty = true
  }

  /** 单文档增/改 */
  indexDoc(doc: SearchDoc): void {
    if (this.mini.has(doc.id)) this.mini.replace(doc)
    else {
      this.mini.add(doc)
      this.docs.set(doc.id, doc)
    }
    this.dirty = true
  }

  /** 移除文档 */
  removeDoc(id: string): void {
    const doc = this.docs.get(id)
    if (doc) {
      this.mini.remove(doc) // MiniSearch.remove 需要完整文档（内部读 id 字段）
      this.docs.delete(id)
      this.dirty = true
    }
  }

  /** 批量同步：与新 docs 列表对比，差量更新 */
  syncWith(docs: SearchDoc[]): { added: number; updated: number; removed: number } {
    const incoming = new Set(docs.map((d) => d.id))
    const existingIds = [...this.docs.keys()]
    let added = 0
    let updated = 0
    let removed = 0
    // 移除不存在的
    for (const id of existingIds) {
      if (!incoming.has(id)) {
        this.removeDoc(id)
        removed++
      }
    }
    for (const d of docs) {
      const had = this.mini.has(d.id)
      this.indexDoc(d)
      if (had) updated++
      else added++
    }
    return { added, updated, removed }
  }

  /** 搜索：返回 Top N 命中 + 摘要 */
  search(query: string, topN = 20): SearchHit[] {
    const trimmed = query.trim()
    if (!trimmed) return []
    const raw = this.mini.search(trimmed).slice(0, topN)
    return raw.map((r) => {
      const body = String((r as unknown as { body: string }).body ?? '')
      const name = String((r as unknown as { name: string }).name ?? '')
      return {
        id: r.id as string,
        name,
        snippet: extractSnippet(body, trimmed),
        score: r.score,
      }
    })
  }

  /** 文档数 */
  size(): number {
    return this.docs.size
  }

  /** 序列化（持久化用） */
  toJSON(): string {
    return JSON.stringify(this.mini.toJSON())
  }

  /** 从持久化恢复 */
  fromJSON(json: string): void {
    this.mini = MiniSearch.loadJSON<SearchDoc>(json, {
      fields: ['name', 'body'],
      storeFields: ['name', 'body', 'updatedAt'],
      tokenize,
      processTerm: (t) => t.toLowerCase(),
      searchOptions: {
        boost: { name: 2 },
        fuzzy: 0.2,
        prefix: true,
      },
    })
    // 从序列化恢复 id 集合（documentIds 是 { shortId: id } 映射）
    const obj = JSON.parse(json) as { documentIds?: Record<string, string> }
    const ids = Object.values(obj.documentIds ?? {})
    this.docs = new Map(ids.map((id) => [id, { id } as SearchDoc]))
    this.dirty = false
  }

  /** 是否需要持久化 */
  isDirty(): boolean {
    return this.dirty
  }

  markClean(): void {
    this.dirty = false
  }
}

/** 在文本中找关键词位置 + 提取前后 60 字摘要 */
function extractSnippet(text: string, query: string, ctx = 60): string {
  if (!text) return ''
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  const i = lower.indexOf(q)
  if (i < 0) return text.slice(0, ctx * 2)
  const start = Math.max(0, i - ctx)
  const end = Math.min(text.length, i + q.length + ctx)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  return prefix + text.slice(start, end) + suffix
}

export { simpleHash, INDEX_KEY }
