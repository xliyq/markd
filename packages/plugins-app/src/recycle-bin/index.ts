/**
 * 回收站（M2.6，Phase 5）
 *
 * L2 模块：30 天自动清理 + 手动清空 + 回收站统计。
 * - 启动时清理一次 + 定期检查（每小时）
 * - 过期判定：deletedAt < now - 30 天
 * - 永久删除走 storage.purgeNode（级联清理 docs/assets/versions）
 */
import type { AppModuleManifest, AppApi } from '@editor/core'
import type { DocNode } from '@editor/shared'

/** 回收站保留期（毫秒）：30 天 */
export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000
/** 定期检查间隔 */
const CLEAN_INTERVAL_MS = 60 * 60 * 1000

export interface RecycleBinModule {
  /** 列出回收站 */
  listTrash: () => Promise<DocNode[]>
  /** 清空回收站（永久删除全部） */
  emptyTrash: () => Promise<number>
  /** 永久删除指定项 */
  purge: (id: string) => Promise<void>
  /** 清理过期（>30 天）的回收站项，返回清理数 */
  cleanExpired: () => Promise<number>
  /** 启动定时清理（bootstrap 调用） */
  start: () => void
  stop: () => void
}

export function createRecycleBinModule(api: AppApi): RecycleBinModule {
  const useStorage = () => {
    const s = api.storage
    if (!s) throw new Error('[recycle-bin] storage 未注入')
    return s
  }
  let timer: ReturnType<typeof setInterval> | null = null

  /** 递归收集全部节点（含已删除；无 listAll 接口，逐层 listChildren 遍历） */
  async function collectAll(parentId: string | null = null, acc: DocNode[] = []): Promise<DocNode[]> {
    const children = await useStorage().listChildren(parentId)
    for (const c of children) {
      acc.push(c)
      // 已删除节点也可能有子节点（删除时子树一并标记）
      await collectAll(c.id, acc)
    }
    return acc
  }

  async function listTrash(): Promise<DocNode[]> {
    const all = await collectAll()
    return all.filter((n) => n.deletedAt != null)
  }

  async function cleanExpired(): Promise<number> {
    const trash = await listTrash()
    const cutoff = Date.now() - TRASH_RETENTION_MS
    const expired = trash.filter((n) => (n.deletedAt ?? 0) < cutoff)
    for (const n of expired) {
      await useStorage().purgeNode(n.id)
    }
    return expired.length
  }

  async function emptyTrash(): Promise<number> {
    const trash = await listTrash()
    for (const n of trash) {
      await useStorage().purgeNode(n.id)
    }
    return trash.length
  }

  async function purge(id: string): Promise<void> {
    await useStorage().purgeNode(id)
  }

  function start(): void {
    if (typeof window === 'undefined') return
    // 启动立即清理一次
    void cleanExpired()
    timer = setInterval(() => void cleanExpired(), CLEAN_INTERVAL_MS)
  }

  return {
    listTrash,
    emptyTrash,
    purge,
    cleanExpired,
    start,
    stop() {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    },
  }
}

export const recycleBinManifest: AppModuleManifest = {
  id: 'recycle-bin',
  type: 'app',
  name: '回收站',
  version: '1.0.0',
  description: '30 天自动清理 + 清空回收站（M2.6）',
  dependsOn: ['document-tree'],
  defaultEnabled: true,
  mount: (api) => {
    const mod = createRecycleBinModule(api)
    ;(api as unknown as Record<string, unknown>).recycleBin = mod
    mod.start()
    return { name: '回收站', dispose: () => mod.stop() }
  },
}
