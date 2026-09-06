// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { DexieStorageProvider } from '@editor/infra'
import { createImportModule } from '../import'
import type { ImportModule } from '../import'

/**
 * Phase 2 —— 导入 .md 单测（M3.3）：
 * 文件读取 → 新建文档（files + docs 双表）→ 返回 docId 供打开。
 */

describe('import 导入 .md 模块', () => {
  let storage: DexieStorageProvider
  let imp: ImportModule

  beforeAll(() => {
    storage = new DexieStorageProvider()
    imp = createImportModule({ storage } as never)
  })
  afterAll(() => storage.dispose())

  beforeEach(async () => {
    const db = (storage as unknown as { db: { files: { clear: () => Promise<void> }; docs: { clear: () => Promise<void> } } }).db
    await db.files.clear()
    await db.docs.clear()
  })

  it('导入 .md → 文档创建 + 内容写入 + 文件名去后缀', async () => {
    const file = new File(['# 导入的文档\n\n内容 **ok**'], '周报.md', { type: 'text/markdown' })
    const result = await imp.importMd(file)

    expect(result.name).toBe('周报')
    expect(result.size).toBeGreaterThan(0)
    expect(result.docId).toBeTruthy()

    // 双表落库
    const node = await storage.getNode(result.docId)
    expect(node?.name).toBe('周报')
    const doc = await storage.getDocContent(result.docId)
    expect(doc?.content).toContain('# 导入的文档')
  })

  it('导入到指定父文件夹', async () => {
    // 建文件夹
    const folder = {
      id: 'folder-1', parentId: null as string | null, type: 'folder' as const,
      name: '导入区', sortOrder: 0, createdAt: 1, updatedAt: 1, deletedAt: null,
    }
    await storage.createNode(folder)

    const file = new File(['内容'], 'note.md', { type: 'text/markdown' })
    const result = await imp.importMd(file, 'folder-1')
    const node = await storage.getNode(result.docId)
    expect(node?.parentId).toBe('folder-1')
  })

  it('非 .md 文件名保留原名（无后缀剥离）', async () => {
    const file = new File(['x'], '读书笔记', { type: 'text/markdown' })
    const result = await imp.importMd(file)
    expect(result.name).toBe('读书笔记')
  })
})
