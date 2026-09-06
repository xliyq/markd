/**
 * 全文搜索（ADR-016，Phase 5）
 *
 * L2 模块：把 SearchManager 接到应用数据。
 * - 启动：全量索引现有文档（递归收集）→ 持久化恢复 → 增量订阅
 * - 变更：doc:changed（编辑）/ doc:created（新建）/ doc:deleted（删除）→ 增量更新
 * - 查询：search(query) → SearchHit[]（id + 标题 + 摘要）
 * - 持久化：索引 JSON 存 settings（key=search.index.v1）
 */
import type { AppModuleManifest, AppApi } from '@editor/core'
import { SearchManager, simpleHash, INDEX_KEY } from '@editor/infra'
import type { SearchHit } from '@editor/infra'

export interface SearchModule {
  /** 搜索全部文档（Top N） */
  search: (query: string, topN?: number) => SearchHit[]
  /** 重建索引（全量） */
  rebuildIndex: () => Promise<number>
  /** 索引文档数 */
  size: () => number
}

interface DocLike {
  id: string
  name: string
  content: string
}

export function createSearchModule(api: AppApi): SearchModule {
  const manager = new SearchManager()
  const useStorage = () => {
    const s = api.storage
    if (!s) throw new Error('[search] storage 未注入')
    return s
  }

  /** 递归收集所有文档内容（files 树 → docs） */
  async function collectAllDocs(): Promise<DocLike[]> {
    const st = useStorage()
    const results: DocLike[] = []
    async function walk(parentId: string | null): Promise<void> {
      const children = await st.listChildren(parentId)
      for (const c of children) {
        if (c.type === 'doc' && c.deletedAt == null) {
          const d = await st.getDocContent(c.id)
          if (d) results.push({ id: c.id, name: c.name, content: d.content })
        }
        await walk(c.id)
      }
    }
    await walk(null)
    return results
  }

  /** 持久化索引 */
  async function persist(): Promise<void> {
    if (!manager.isDirty()) return
    try {
      await useStorage().setSetting(INDEX_KEY, manager.toJSON())
      manager.markClean()
    } catch (e) {
      console.warn('[search] 索引持久化失败', e)
    }
  }

  async function rebuildIndex(): Promise<number> {
    const docs = await collectAllDocs()
    manager.rebuild(docs.map((d) => ({
      id: d.id,
      name: d.name,
      body: d.content,
      hash: simpleHash(d.content),
      updatedAt: Date.now(),
    })))
    await persist()
    return docs.length
  }

  return {
    search: (q, topN = 20) => manager.search(q, topN),
    rebuildIndex,
    size: () => manager.size(),
  }
}

export const searchManifest: AppModuleManifest = {
  id: 'search',
  type: 'app',
  name: '全文搜索',
  version: '1.0.0',
  description: 'MiniSearch 全文搜索（ADR-016）：中文分词 + 摘要 + 增量索引',
  dependsOn: [],
  defaultEnabled: true,
  mount: (api) => {
    const mod = createSearchModule(api)
    ;(api as unknown as Record<string, unknown>).search = mod
    // 启动异步重建索引（不阻塞装配）
    void mod.rebuildIndex()
    return { name: '全文搜索', dispose: () => {
      delete (api as unknown as Record<string, unknown>).search
    } }
  },
}
