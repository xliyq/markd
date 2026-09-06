/**
 * 数据备份（M7.2，P1）
 *
 * 全量 JSON 备份 / 恢复：
 * - 导出：遍历 files/docs/assets/versions/settings/meta 六表，
 *   assets 的 Blob → base64（JSON 无法存 Blob），打包为单文件 JSON。
 * - 导入：解析 JSON → 重建六表（清空后全量写入），返回统计。
 *
 * 纯数据模块：不碰 DOM（下载/上传由 UI 层处理），可在 Node 单测。
 */
import type { AppModuleManifest, AppApi } from '@editor/core'
import type { DocAsset } from '@editor/shared'

/** Blob → base64（Node 兼容：Buffer / 浏览器 FileReader） */
export async function blobToBase64(blob: Blob): Promise<string> {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(await blob.arrayBuffer())
    return buf.toString('base64')
  }
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** base64 → Blob */
export function base64ToBlob(b64: string, mime: string): Blob {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(b64, 'base64')
    return new Blob([new Uint8Array(buf)], { type: mime })
  }
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export interface BackupPayload {
  app: 'milkdown'
  version: 1
  exportedAt: number
  files: unknown[]
  docs: unknown[]
  assets: (Omit<DocAsset, 'blob'> & { blobBase64?: string })[]
  versions: unknown[]
  settings: unknown[]
  meta: unknown[]
}

export interface BackupModule {
  exportBackup: () => Promise<{ json: string; name: string }>
  importBackup: (json: string) => Promise<{ files: number; docs: number; assets: number }>
}

export function createBackupModule(api: AppApi): BackupModule {
  const useStorage = () => {
    const s = api.storage
    if (!s) throw new Error('[backup] storage 未注入')
    return s
  }

  async function exportBackup() {
    const s = useStorage()
    const db = (s as unknown as { db: {
      files: { toArray: () => Promise<unknown[]> }
      docs: { toArray: () => Promise<unknown[]> }
      assets: { toArray: () => Promise<DocAsset[]> }
      versions: { toArray: () => Promise<unknown[]> }
      settings: { toArray: () => Promise<unknown[]> }
      meta: { toArray: () => Promise<unknown[]> }
    } }).db

    const [files, docs, assets, versions, settings, meta] = await Promise.all([
      db.files.toArray(),
      db.docs.toArray(),
      db.assets.toArray(),
      db.versions.toArray(),
      db.settings.toArray(),
      db.meta.toArray(),
    ])

    // assets：blob → base64
    const assetsOut = await Promise.all(
      assets.map(async (a) => {
        const { blob, ...rest } = a
        return { ...rest, blobBase64: blob ? await blobToBase64(blob) : undefined }
      }),
    )

    const payload: BackupPayload = {
      app: 'milkdown',
      version: 1,
      exportedAt: Date.now(),
      files,
      docs,
      assets: assetsOut,
      versions,
      settings,
      meta,
    }

    const name = `milkdown-backup-${new Date().toISOString().slice(0, 10)}.json`
    return { json: JSON.stringify(payload), name }
  }

  async function importBackup(json: string) {
    const s = useStorage()
    const payload = JSON.parse(json) as BackupPayload
    if (payload.app !== 'milkdown' || !payload.version) {
      throw new Error('[backup] 无效的备份文件')
    }
    const db = (s as unknown as { db: {
      files: { clear: () => Promise<void>; bulkPut: (v: unknown[]) => Promise<void> }
      docs: { clear: () => Promise<void>; bulkPut: (v: unknown[]) => Promise<void> }
      assets: { clear: () => Promise<void>; bulkPut: (v: unknown[]) => Promise<void> }
      versions: { clear: () => Promise<void>; bulkPut: (v: unknown[]) => Promise<void> }
      settings: { clear: () => Promise<void>; bulkPut: (v: unknown[]) => Promise<void> }
      meta: { clear: () => Promise<void>; bulkPut: (v: unknown[]) => Promise<void> }
    } }).db

    // 全量恢复：清空后写入（备份语义 = 完整快照还原）
    await db.files.clear()
    await db.docs.clear()
    await db.assets.clear()
    await db.versions.clear()
    await db.settings.clear()
    await db.meta.clear()

    if (payload.files?.length) await db.files.bulkPut(payload.files)
    if (payload.docs?.length) await db.docs.bulkPut(payload.docs)
    if (payload.assets?.length) {
      const assetsIn = payload.assets.map((a) => ({
        ...a,
        blob: a.blobBase64 ? base64ToBlob(a.blobBase64, a.mime) : undefined,
      }))
      await db.assets.bulkPut(assetsIn as never)
    }
    if (payload.versions?.length) await db.versions.bulkPut(payload.versions)
    if (payload.settings?.length) await db.settings.bulkPut(payload.settings)
    if (payload.meta?.length) await db.meta.bulkPut(payload.meta)

    return {
      files: payload.files?.length ?? 0,
      docs: payload.docs?.length ?? 0,
      assets: payload.assets?.length ?? 0,
    }
  }

  return { exportBackup, importBackup }
}

export const backupManifest: AppModuleManifest = {
  id: 'backup',
  type: 'app',
  name: '数据备份',
  version: '1.0.0',
  description: '全量 JSON 导出 / 导入恢复（M7.2）',
  dependsOn: [],
  defaultEnabled: true,
  mount: (api) => {
    const mod = createBackupModule(api)
    ;(api as unknown as Record<string, unknown>).backup = mod
    return { name: '数据备份', dispose: () => {
      delete (api as unknown as Record<string, unknown>).backup
    } }
  },
}
