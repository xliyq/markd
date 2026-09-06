/**
 * 导入 Markdown（M3.3）
 *
 * 打开本地 .md 文件 → 读取内容 → 新建文档（files + docs 双表）→ 返回 docId。
 * UI 层拿到 docId 后调 openDocument 进入编辑。
 */
import type { AppModuleManifest, AppApi } from '@editor/core'
import type { DocNode } from '@editor/shared'

export interface ImportResult {
  docId: string
  /** 文件名（去 .md 后缀）作为文档名 */
  name: string
  /** 内容长度 */
  size: number
}

export interface ImportModule {
  /** 导入 .md 文件为文档，返回文档信息（UI 用它打开） */
  importMd: (file: File, parentId?: string | null) => Promise<ImportResult>
}

export function createImportModule(api: AppApi): ImportModule {
  async function importMd(file: File, parentId: string | null = null): Promise<ImportResult> {
    const st = api.storage
    if (!st) throw new Error('[import] AppApi 未注入 storage')

    const name = file.name.replace(/\.md$/i, '') || '未命名文档'
    const content = await file.text()

    // 新建文档
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
    await st.createNode(node)
    await st.saveDocContent({ id: node.id, content })

    return { docId: node.id, name, size: content.length }
  }

  return { importMd }
}

export const importManifest: AppModuleManifest = {
  id: 'import',
  type: 'app',
  name: '导入',
  version: '1.0.0',
  description: '导入本地 .md 文件为文档（M3.3）',
  dependsOn: [],
  defaultEnabled: true,
  mount: (api) => {
    const mod = createImportModule(api)
    ;(api as unknown as Record<string, unknown>).import = mod
    return { name: '导入', dispose: () => {
      delete (api as unknown as Record<string, unknown>).import
    } }
  },
}
