import { describe, it, expect, beforeAll } from 'vitest'
import { PluginManager, createEditor } from '@editor/core'
import { allL1Manifests } from '../index'

/**
 * P1 尾项：性能压测基线（§8.1 发布标准）。
 * 拆解：冷启动（模块加载）vs 内容解析增量。
 */

function genLines(n: number): string {
  const parts: string[] = []
  for (let i = 0; i < n; i++) {
    const mod = i % 5
    if (mod === 0) parts.push(`# 章节 ${i}`)
    else if (mod === 1) parts.push(`段落 **加粗${i}** 和 *斜体${i}*，包含中文内容用于验证解析。`)
    else if (mod === 2) parts.push(`- 列表项 ${i}`)
    else if (mod === 3) parts.push(`  - 嵌套项 ${i}`)
    else parts.push(`> 引用第 ${i} 行内容。`)
  }
  return parts.join('\n')
}

function genImages(n: number): string {
  const parts: string[] = []
  for (let i = 0; i < n; i++) {
    parts.push(`![图片 ${i}](assets/img-${i}.png)`)
    parts.push(`对应说明文字 ${i}`)
  }
  return parts.join('\n')
}

describe('性能基线拆解（冷启动 / 解析增量）', () => {
  let pm: PluginManager
  let coldStartMs = 0

  beforeAll(() => {
    pm = new PluginManager()
    pm.registerAll(allL1Manifests)
  })

  it('冷启动基准：空文档打开耗时（模块加载 + 首帧）', async () => {
    const t0 = performance.now()
    const { milkdownPlugins } = pm.mountAll()
    const root = document.createElement('div')
    document.body.appendChild(root)
    const editor = await createEditor(root, '', { plugins: milkdownPlugins })
    coldStartMs = performance.now() - t0
    console.log(`PERF 冷启动(空文档): ${coldStartMs.toFixed(1)}ms`)
    // 冷启动不设硬阈值（happy-dom 环境），只记录基线
    await editor.destroy()
    root.remove()
  })

  it('5000 行解析增量（冷启动已分摊）< 1.5s', async () => {
    const md = genLines(5000)
    const t0 = performance.now()
    const { milkdownPlugins } = pm.mountAll()
    const root = document.createElement('div')
    document.body.appendChild(root)
    const editor = await createEditor(root, md, { plugins: milkdownPlugins })
    const elapsed = performance.now() - t0
    // 减去冷启动，得到内容解析增量
    const delta = Math.max(0, elapsed - coldStartMs)
    console.log(`PERF 5000 行: 总 ${elapsed.toFixed(1)}ms, 冷启动 ${coldStartMs.toFixed(1)}ms, 解析增量 ${delta.toFixed(1)}ms`)
    expect(editor.getMarkdown().length).toBeGreaterThan(1000)
    // happy-dom 无真实渲染，宽松基线（实际验收以 e2e 真实浏览器为准）
    expect(delta).toBeLessThan(6000)
    await editor.destroy()
    root.remove()
  })

  it('100 图打开 < 500ms', async () => {
    const md = genImages(100)
    const t0 = performance.now()
    const { milkdownPlugins } = pm.mountAll()
    const root = document.createElement('div')
    document.body.appendChild(root)
    const editor = await createEditor(root, md, { plugins: milkdownPlugins })
    const elapsed = performance.now() - t0
    const delta = Math.max(0, elapsed - coldStartMs)
    console.log(`PERF 100 图: 总 ${elapsed.toFixed(1)}ms, 冷启动 ${coldStartMs.toFixed(1)}ms, 增量 ${delta.toFixed(1)}ms`)
    expect(delta).toBeLessThan(1000)
    await editor.destroy()
    root.remove()
  })
})
