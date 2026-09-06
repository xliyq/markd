/**
 * 图片管理（M4.2/M4.2a）
 *
 * L2 模块：图片存储管线核心——
 * 1. uploader：粘贴/拖拽/选择器来的文件 → T1 assets 落库（Dexie）→ 返回 image node 引用相对路径
 * 2. getBlobUrl：渲染时 assets/xxx → blob URL（AssetResolver 的核心）
 * 3. resolveDocAssets：文档内全部相对路径 → blob URL 映射（导出/渲染联动）
 *
 * T1 默认：assets 表存 blob，Markdown 引用 assets/xxx.png（可移植，R7）。
 * T2 预留：图床配置注入后 uploader 可改为上传远程 URL。
 */
import type { AppModuleManifest, AppApi } from '@editor/core'
import type { DocAsset } from '@editor/shared'

export interface ImageManagerModule {
  /** M4.2 uploader：文件 → assets 落库 → 返回 [{type:'text', text}] 占位或 image 引用（值由调用方插入） */
  handleFiles: (files: FileList | File[]) => Promise<Map<string, string>>
  /** M4.2a 渲染解析：assets/xxx → blob URL（不存在返回空串） */
  getBlobUrl: (docId: string, relPath: string) => Promise<string>
  /** M4.2a 文档内全部 assets 相对路径 → blob URL */
  resolveDocAssets: (docId: string) => Promise<Map<string, string>>
  /** 全部插入方式共用：File → 落库并返回 relPath */
  saveImageFile: (docId: string, file: File) => Promise<string>
}

/** 生成 assets 目录下的唯一文件名 */
function assetFilename(file: File): string {
  const ext = file.name.match(/\.[a-z0-9]+$/i)?.[0] ?? '.png'
  return `assets/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`
}

export function createImageManagerModule(api: AppApi): ImageManagerModule {
  const storage = api.storage
  if (!storage) throw new Error('[image-manager] AppApi 未注入 storage')

  // 闭包内重取（TS 不保留可选引用收窄）
  const useStorage = () => {
    const s = api.storage
    if (!s) throw new Error('[image-manager] storage 未注入')
    return s
  }

  async function saveImageFile(docId: string, file: File): Promise<string> {
    const relPath = assetFilename(file)
    const asset: DocAsset = {
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      docId,
      relPath,
      mime: file.type || 'application/octet-stream',
      size: file.size,
      tier: 'local',
      blob: file,
      hash: `${file.size}-${file.name}`,
      createdAt: Date.now(),
    }
    await useStorage().putAsset(asset)
    return relPath
  }

  async function handleFiles(files: FileList | File[]): Promise<Map<string, string>> {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
    const relPaths = await Promise.all(
      list.map((f) => saveImageFile('pending', f)), // docId 由编辑器挂载时绑定，此处占位
    )
    const map = new Map<string, string>()
    list.forEach((f, i) => map.set(f.name, relPaths[i] ?? ''))
    return map
  }

  async function getBlobUrl(docId: string, relPath: string): Promise<string> {
    const asset = await useStorage().getAsset(docId, relPath)
    if (!asset?.blob) return ''
    return URL.createObjectURL(asset.blob)
  }

  async function resolveDocAssets(docId: string): Promise<Map<string, string>> {
    const assets = await useStorage().listAssets(docId)
    const map = new Map<string, string>()
    for (const a of assets) {
      if (!a.blob) continue
      map.set(a.relPath, URL.createObjectURL(a.blob))
    }
    return map
  }

  return { handleFiles, getBlobUrl, resolveDocAssets, saveImageFile }
}

export const imageManagerManifest: AppModuleManifest = {
  id: 'image-manager',
  type: 'app',
  name: '图片管理',
  version: '1.0.0',
  description: '图片存储管线（T1 assets 落库 + AssetResolver），M4.2/M4.2a',
  dependsOn: [],
  defaultEnabled: true,
  mount: (api) => {
    const mod = createImageManagerModule(api)
    ;(api as unknown as Record<string, unknown>).imageManager = mod
    return { name: '图片管理', dispose: () => {
      delete (api as unknown as Record<string, unknown>).imageManager
    } }
  },
}
