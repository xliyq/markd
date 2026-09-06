import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createMinimalEditor } from '../editor-factory'

/**
 * S3 验证：官方 table-block 真实渲染表格
 * 使用 vitest 的 happy-dom 环境（自动提供 window/document）。
 */
const tableMd = `# 表格测试

| 名称   | 价格 | 库存 |
| ------ | ---- | ---- |
| 苹果   | 5    | 100  |
| 香蕉   | 3    | 200  |
`

describe('S3 表格交互 spike', () => {
  let root: HTMLElement
  let editor: Awaited<ReturnType<typeof createMinimalEditor>>

  beforeAll(async () => {
    root = document.createElement('div')
    document.body.appendChild(root)
    editor = await createMinimalEditor(root, tableMd)
  })

  afterAll(async () => {
    await editor.destroy()
  })

  it('表格 Markdown 可被解析并渲染为 <table>', () => {
    const table = root.querySelector('table')
    expect(table).not.toBeNull()
  })

  it('表格包含 3 行（表头 + 2 数据行）与 3 列表头', () => {
    const rows = root.querySelectorAll('table tr')
    expect(rows.length).toBe(3)
    const headers = root.querySelectorAll('table th')
    expect(headers.length).toBe(3)
    expect(headers[0]?.textContent).toContain('名称')
  })

  it('markdown 原文保真（序列化往返）', () => {
    const md = editor.getMarkdown()
    expect(md).toContain('| 名称')
    expect(md).toContain('苹果')
    expect(md).toContain('100')
  })
})
