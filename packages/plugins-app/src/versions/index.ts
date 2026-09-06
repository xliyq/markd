/**
 * 版本快照（M2.4/M7.6，Phase 5）
 *
 * L2 模块：订阅 doc:changed（保存完成）→ 落版本快照 + trim 保留策略。
 * 提供：列表、恢复（写回 docs）、手动快照。
 *
 * 保留策略（03 §3.4）：autosave 快照保留最近 N 条（默认 20），manual 常驻（可配上限）。
 * 底层 trimVersions 已在 DexieStorageProvider 实现。
 */
import type { AppModuleManifest, AppApi } from '@editor/core'
import type { DocVersion, SnapshotReason } from '@editor/shared'

// 与 infra/dexie 常量对齐（导出以便测试断言）
export const AUTOSAVE_KEEP = 20
export const MANUAL_KEEP = 200

export interface VersionsModule {
  /** 创建快照（manual 由用户触发；autosave 由内部订阅触发） */
  snapshot: (docId: string, content: string, reason?: SnapshotReason) => Promise<void>
  /** 文档版本列表（新→旧） */
  list: (docId: string) => Promise<DocVersion[]>
  /** 恢复某版本（写回 docs.content） */
  restore: (docId: string, versionId: string) => Promise<boolean>
  /** 订阅保存事件自动快照（bootstrap 调用） */
  subscribe: () => void
  dispose: () => void
}

export function createVersionsModule(api: AppApi): VersionsModule {
  const useStorage = () => {
    const s = api.storage
    if (!s) throw new Error('[versions] storage 未注入')
    return s
  }

  let offEvent: (() => void) | undefined

  async function snapshot(docId: string, content: string, reason: SnapshotReason = 'manual'): Promise<void> {
    await useStorage().createVersion(docId, content, reason)
    await useStorage().trimVersions(docId)
  }

  async function list(docId: string): Promise<DocVersion[]> {
    return useStorage().listVersions(docId)
  }

  async function restore(docId: string, versionId: string): Promise<boolean> {
    const v = await useStorage().getVersion(versionId)
    if (!v || v.docId !== docId) return false
    await useStorage().saveDocContent({ id: docId, content: v.content })
    // 恢复后通知（UI 刷新 / 冲突检测等）
    api.emit?.('doc:restored', { docId, versionId })
    return true
  }

  function subscribe(): void {
    // doc:changed 每次保存完成 → 打一条 autosave 快照
    offEvent = api.on?.('doc:changed', (payload: unknown) => {
      const p = payload as { docId: string; markdown: string }
      if (!p?.docId) return
      void snapshot(p.docId, p.markdown, 'autosave')
    })
  }

  return {
    snapshot,
    list,
    restore,
    subscribe,
    dispose() {
      offEvent?.()
    },
  }
}

export const versionsManifest: AppModuleManifest = {
  id: 'versions',
  type: 'app',
  name: '版本快照',
  version: '1.0.0',
  description: '自动/手动版本快照 + 保留策略（20 autosave / 200 manual）+ 恢复',
  dependsOn: ['autosave'],
  defaultEnabled: true,
  mount: (api) => {
    const mod = createVersionsModule(api)
    ;(api as unknown as Record<string, unknown>).versions = mod
    mod.subscribe()
    return { name: '版本快照', dispose: () => mod.dispose() }
  },
}
