/**
 * 文档持久化（M2.1 文档管理基础）
 *
 * L2 模块：桥接 StorageProvider 与 EditorInstance——首次挂载时加载文档内容，
 * 提供 save（手动保存）能力。自动保存由 autosave 模块负责。
 *
 * 依赖：core（AppApi 注入的 editor/storage）+ shared（类型）
 */
import type { AppModuleManifest, AppApi } from '@editor/core'
import type { DocNode, DocContent } from '@editor/shared'

export function createPersistenceModule(api: AppApi) {
  const { storage } = api
  if (!storage) {
    throw new Error('[persistence] AppApi 未注入 storage（装配顺序错误）')
  }

  return {
    /** 加载文档内容（应用壳用返回值创建编辑器实例） */
    async open(docId: string): Promise<DocContent | undefined> {
      return storage.getDocContent(docId)
    },

    /** 保存内容到存储 */
    async save(docId: string, content: string): Promise<void> {
      await storage.saveDocContent({ id: docId, content })
    },

    /** 新建文档（写入 files + docs 两表） */
    async create(name: string, parentId: string | null): Promise<DocNode> {
      const now = Date.now()
      const node: DocNode = {
        id: crypto.randomUUID?.() ?? `${now}-${Math.random().toString(16).slice(2)}`,
        parentId,
        type: 'doc',
        name,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }
      await storage.createNode(node)
      const content: DocContent = {
        id: node.id,
        content: '',
        contentHash: '',
        updatedAt: now,
      }
      await storage.saveDocContent(content)
      return node
    },
  }
}

export const persistenceManifest: AppModuleManifest = {
  id: 'persistence',
  type: 'app',
  name: '文档持久化',
  version: '1.0.0',
  description: '文档加载/保存/新建（桥接存储与编辑器）',
  dependsOn: [],
  defaultEnabled: true,
  mount: (api) => {
    // 挂在 api 上供其他 L2 模块调用
    const mod = createPersistenceModule(api)
    ;(api as unknown as Record<string, unknown>).persistence = mod
    return { name: '文档持久化', dispose: () => {
      delete (api as unknown as Record<string, unknown>).persistence
    } }
  },
}
