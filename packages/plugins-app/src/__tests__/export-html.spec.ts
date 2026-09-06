// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { DexieStorageProvider } from '@editor/infra'
import { inlineAssetRefs, createExportModule } from '../export'

/**
 * Phase 2 —— 导出 HTML 单测（M3.2）：
 * markdown → 独立完整 HTML（自带样式可发布）：标题/列表/表格/代码块/GFM 任务列表。
 */

describe('exportHtml 导出独立 HTML', () => {
  let storage: DexieStorageProvider
  let exp: ReturnType<typeof createExportModule>

  const md = `# 文档标题

正文段落 **加粗** 与 *斜体*。

## 列表

- 项 A
- 项 B

## 表格

| 名称 | 值 |
| ---- | -- |
| x    | 1  |

\`\`\`js
const a = 1
\`\`\`

- [x] 已完成任务
- [ ] 未完成任务
`

  beforeAll(() => {
    storage = new DexieStorageProvider()
    exp = createExportModule({ storage } as never)
  })
  afterAll(() => storage.dispose())

  beforeEach(async () => {
    const db = (storage as unknown as { db: { files: { clear: () => Promise<void> }; docs: { clear: () => Promise<void> } } }).db
    await db.files.clear()
    await db.docs.clear()
  })

  async function seedDoc() {
    await storage.createNode({
      id: 'doc-1', parentId: null, type: 'doc', name: '测试文档',
      sortOrder: 0, createdAt: 1, updatedAt: 1, deletedAt: null,
    })
    await storage.saveDocContent({ id: 'doc-1', content: md })
  }

  it('生成完整 HTML 文档（doctype + 内嵌样式 + title）', async () => {
    await seedDoc()
    const html = await exp.exportHtml('doc-1')
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<title>测试文档</title>')
    expect(html).toContain('</html>')
    // 内嵌样式（可发布）
    expect(html).toContain('<style>')
    expect(html).toContain('max-width: 820px')
  })

  it('内容结构正确：标题/加粗/列表/表格/代码块', async () => {
    await seedDoc()
    const html = await exp.exportHtml('doc-1')
    expect(html).toContain('<h1>文档标题</h1>')
    expect(html).toContain('<h2>列表</h2>')
    expect(html).toContain('<strong>加粗</strong>')
    expect(html).toContain('<li>项 A</li>')
    expect(html).toContain('<table>')
    expect(html).toContain('<th>名称</th>')
    // 代码块带语言 class + 尾随换行（remark 标准输出）
    expect(html).toContain('<code class="language-js">const a = 1')
  })

  it('GFM 任务列表被转换', async () => {
    await seedDoc()
    const html = await exp.exportHtml('doc-1')
    expect(html).toContain('已') // 中文保留
    expect(html).toMatch(/checkbox|checked/i)
  })

  it('标题/文件名特殊字符被转义', async () => {
    await storage.createNode({
      id: 'doc-2', parentId: null, type: 'doc', name: 'A <B> & "C"',
      sortOrder: 0, createdAt: 1, updatedAt: 1, deletedAt: null,
    })
    await storage.saveDocContent({ id: 'doc-2', content: '# hi' })
    const html = await exp.exportHtml('doc-2')
    expect(html).toContain('&lt;B&gt;')
    expect(html).toContain('&amp;')
    expect(html).not.toContain('<B>') // 未转义的原始标签
  })
})

describe("inlineAssetRefs", () => {
  it("把本地资产 src 替换为 data URL", () => {
    const html = '<img src="assets/a.png" alt="x"><img src="https://r.com/b.png">'
    const out = inlineAssetRefs(html, { "assets/a.png": "data:image/png;base64,AAA" })
    expect(out).toContain('src="data:image/png;base64,AAA"')
    expect(out).toContain('src="https://r.com/b.png"')
  })
  it("未收集到的 relPath 原样保留", () => {
    const out = inlineAssetRefs('<img src="assets/missing.png">', {})
    expect(out).toContain('src="assets/missing.png"')
  })
})
