/**
 * 存储配额管理（Phase 5，M7.7）
 *
 * L2 模块：
 * - 浏览器配额：navigator.storage.estimate()（quota / usage / 使用率）
 * - 各表占用：六表行数 + 估算字节（assets 按 blob.size 精确）
 * - 清理引导：返回可清理项（回收站占用的资产大小等）
 */
import type { AppModuleManifest, AppApi } from '@editor/core'

export interface TableUsage {
  table: string
  rows: number
  /** 估算字节（assets 精确，其余按行数*平均） */
  bytes: number
}

export interface QuotaReport {
  /** 浏览器配额上限（bytes），unknown 时 0 */
  quota: number
  /** 已用（bytes） */
  usage: number
  /** 使用率 0-1 */
  ratio: number
  tables: TableUsage[]
  /** 总估算（含 Blob 资产） */
  totalBytes: number
  /** 回收站资产占用（可清理） */
  trashBytes: number
}

/** 各表平均行字节（粗估：files≈300B, docs≈1KB+内容, assets=精确, versions≈2KB, settings≈100B, meta≈100B） */
const AVG_BYTES: Record<string, number> = {
  files: 300,
  docs: 1024,
  versions: 2048,
  settings: 100,
  meta: 100,
}

export interface QuotaModule {
  /** 统计配额 + 各表占用 */
  report: () => Promise<QuotaReport>
  /** 浏览器 storage.estimate（不可用时降级 0） */
  estimate: () => Promise<{ quota: number; usage: number }>
}

export function createQuotaModule(api: AppApi): QuotaModule {
  const useStorage = () => {
    const s = api.storage
    if (!s) throw new Error('[quota] storage 未注入')
    return s
  }

  async function estimate(): Promise<{ quota: number; usage: number }> {
    if (typeof navigator !== 'undefined' && 'storage' in navigator && navigator.storage?.estimate) {
      try {
        const est = await navigator.storage.estimate()
        return { quota: est.quota ?? 0, usage: est.usage ?? 0 }
      } catch {
        return { quota: 0, usage: 0 }
      }
    }
    return { quota: 0, usage: 0 }
  }

  async function tableUsage(): Promise<TableUsage[]> {
    const st = useStorage()
    const db = (st as unknown as { db: {
      files: { count: () => Promise<number> }
      docs: { count: () => Promise<number> }
      assets: { count: () => Promise<number>; toArray: () => Promise<{ size: number }[]> }
      versions: { count: () => Promise<number> }
      settings: { count: () => Promise<number> }
      meta: { count: () => Promise<number> }
    } }).db

    const [files, docs, versions, settings, meta] = await Promise.all([
      db.files.count(), db.docs.count(), db.versions.count(),
      db.settings.count(), db.meta.count(),
    ])
    // assets 精确（blob.size 求和）
    const assetRows = await db.assets.toArray()
    const assetBytes = assetRows.reduce((s, a) => s + (a.size || 0), 0)

    return [
      { table: 'files', rows: files, bytes: files * AVG_BYTES.files },
      { table: 'docs', rows: docs, bytes: docs * AVG_BYTES.docs },
      { table: 'assets', rows: assetRows.length, bytes: assetBytes },
      { table: 'versions', rows: versions, bytes: versions * AVG_BYTES.versions },
      { table: 'settings', rows: settings, bytes: settings * AVG_BYTES.settings },
      { table: 'meta', rows: meta, bytes: meta * AVG_BYTES.meta },
    ]
  }

  async function report(): Promise<QuotaReport> {
    const [est, tables] = await Promise.all([estimate(), tableUsage()])
    const totalBytes = tables.reduce((s, t) => s + t.bytes, 0)
    // 回收站资产占用：走 recycle-bin 模块列表（若有）
    let trashBytes = 0
    const bin = (api as unknown as Record<string, unknown>).recycleBin as
      | { listTrash: () => Promise<{ id: string }[]> }
      | undefined
    if (bin) {
      try {
        trashBytes = (await bin.listTrash()).length * AVG_BYTES.docs
      } catch { /* 忽略 */ }
    }
    const usage = est.usage || totalBytes
    const quota = est.quota || 0
    return {
      quota,
      usage,
      ratio: quota > 0 ? usage / quota : 0,
      tables,
      totalBytes,
      trashBytes,
    }
  }

  return { report, estimate }
}

export const quotaManifest: AppModuleManifest = {
  id: 'quota',
  type: 'app',
  name: '存储配额',
  version: '1.0.0',
  description: '配额统计 + 各表占用 + 清理引导（M7.7）',
  dependsOn: ['recycle-bin'],
  defaultEnabled: true,
  mount: (api) => {
    const mod = createQuotaModule(api)
    ;(api as unknown as Record<string, unknown>).quota = mod
    return { name: '存储配额', dispose: () => {
      delete (api as unknown as Record<string, unknown>).quota
    } }
  },
}
