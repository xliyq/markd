import { describe, it, expect } from 'vitest'
import { createMinimalEditor } from '../editor-factory'

/**
 * S5 验证：编辑器实例重建（每切文档重建模式）。
 * 架构决策（02 §4.1）：切换文档 = 重建编辑器实例。
 * 验证：同一根节点反复 create/destroy，耗时稳定、无泄漏、Markdown 不串扰。
 */

const docA = '# 文档 A\n\n这是 **第一份** 文档'
const docB = '# 文档 B\n\n这是 *第二份* 文档'

describe('S5 编辑器实例重建 spike', () => {
  it('同一根节点反复创建/销毁 5 次，耗时稳定可用', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)

    const timings: number[] = []
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now()
      const editor = await createMinimalEditor(root, docA)
      const t1 = performance.now()
      await editor.destroy()
      timings.push(t1 - t0)
    }

    // 每次创建应 < 500ms（happy-dom 环境比真实浏览器略慢）
    const max = Math.max(...timings)
    console.log('S5 重建耗时 (ms):', timings.map((t) => t.toFixed(1)).join(', '))
    expect(max).toBeLessThan(500)
  })

  it('重建后内容不串扰（A → B 隔离）', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)

    const e1 = await createMinimalEditor(root, docA)
    const md1 = e1.getMarkdown()
    await e1.destroy()

    const e2 = await createMinimalEditor(root, docB)
    const md2 = e2.getMarkdown()
    await e2.destroy()

    expect(md1).toContain('文档 A')
    expect(md2).toContain('文档 B')
    expect(md2).not.toContain('文档 A')
  })

  it('destroy 后 DOM 被清理（无泄漏）', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)

    const e = await createMinimalEditor(root, docA)
    await e.destroy()

    // Milkdown 清空根节点内容
    expect(root.innerHTML.trim()).toBe('')
  })
})
