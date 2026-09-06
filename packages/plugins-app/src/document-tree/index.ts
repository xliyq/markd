/**
 * 文档树（M2.1/M2.5——文档管理）
 *
 * L2 模块：文档树的纯数据服务（列表/新建/重命名/软删除/恢复），
 * UI 层（FileTree.vue）经 AppApi 调用，不直接碰 storage。
 *
 * 依赖：core（AppApi.storage）+ shared（DocNode 类型）
 */
import type { AppModuleManifest, AppApi } from '@editor/core'
import type { DocNode } from '@editor/shared'

export interface DocumentTreeModule {
  /** 列出某父节点下的未删除子节点（sortOrder 排序） */
  list: (parentId: string | null) => Promise<DocNode[]>
  /** 新建文档（files + docs 双表写入） */
  create: (name: string, parentId?: string | null) => Promise<DocNode>
  /** 新建文件夹 */
  createFolder: (name: string, parentId?: string | null) => Promise<DocNode>
  /** 重命名 */
  rename: (id: string, name: string) => Promise<void>
  /** 软删除（进回收站 M2.6） */
  remove: (id: string) => Promise<void>
  /** 从回收站恢复 */
  restore: (id: string) => Promise<void>
  /** 列出回收站（已删除节点） */
  listTrash: () => Promise<DocNode[]>
  /** 递归收集某节点子树（含自身的所有 id）——删除/导出用 */
  collectSubtree: (id: string) => Promise<string[]>
}

export function createDocumentTreeModule(api: AppApi): DocumentTreeModule {
  const { storage } = api
  if (!storage) throw new Error('[document-tree] AppApi 未注入 storage')

  return {
    async list(parentId = null) {
      const rows = await storage.listChildren(parentId)
      const visible = rows.filter((n) => n.deletedAt == null)
      // doc 节点附内容大小（文档树显示）；失败静默跳过
      return Promise.all(
        visible.map(async (n) => {
          if (n.type !== 'doc') return n
          try {
            const c = await storage.getDocContent(n.id)
            return { ...n, size: c?.content?.length ?? 0 }
          } catch {
            return n
          }
        }),
      )
    },

    async create(name, parentId = null) {
      const now = Date.now()
      const node: DocNode = {
        id:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${now}-${Math.random().toString(16).slice(2)}`,
        parentId,
        type: 'doc',
        name,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }
      await storage.createNode(node)
      await storage.saveDocContent({ id: node.id, content: '', contentHash: '' })
      return node
    },

    async createFolder(name, parentId = null) {
      const now = Date.now()
      const node: DocNode = {
        id:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${now}-${Math.random().toString(16).slice(2)}`,
        parentId,
        type: 'folder',
        name,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }
      await storage.createNode(node)
      return node
    },

    async rename(id, name) {
      await storage.renameNode(id, name)
    },

    async remove(id) {
      await storage.softDelete(id)
    },

    async restore(id) {
      await storage.restoreNode(id)
    },

    async listTrash() {
      const roots = await storage.listChildren(null)
      return roots.filter((n) => n.deletedAt != null)
    },

    async collectSubtree(id) {
      const ids = [id]
      const walk = async (parentId: string) => {
        const children = await storage.listChildren(parentId)
        for (const c of children) {
          if (c.deletedAt != null) continue
          ids.push(c.id)
          if (c.type === 'folder') await walk(c.id)
        }
      }
      const node = await storage.getNode(id)
      if (node?.type === 'folder') await walk(id)
      return ids
    },
  }
}

export const documentTreeManifest: AppModuleManifest = {
  id: 'document-tree',
  type: 'app',
  name: '文档树',
  version: '1.0.0',
  description: '文档树数据服务（列表/新建/重命名/回收站）',
  dependsOn: [], // 与 persistence/autosave 并行，都只依赖 storage
  defaultEnabled: true,
  mount: (api) => {
    const mod = createDocumentTreeModule(api)
    ;(api as unknown as Record<string, unknown>).documentTree = mod
    return { name: '文档树', dispose: () => {
      delete (api as unknown as Record<string, unknown>).documentTree
    } }
  },
}
