import { describe, it, expect, beforeAll } from 'vitest'
import mermaid from 'mermaid'

/**
 * S8 验证：mermaid 大图性能（M0.3 自研方案）。
 * 生成 120 节点的复杂流程图，验证渲染耗时与产物。
 */

// 生成 N 节点流程图（A1→A2→...→An，加分支）
function genFlow(n: number): string {
  const lines = ['flowchart TD']
  for (let i = 1; i <= n; i++) {
    lines.push(`  A${i}["节点 ${i}"]`)
    if (i < n) lines.push(`  A${i} --> A${i + 1}`)
    if (i % 10 === 0 && i + 1 <= n) lines.push(`  A${i} --> B${i / 10}["分支 ${i / 10}"]`)
  }
  return lines.join('\n')
}

describe('S8 mermaid 大图 spike', () => {
  beforeAll(async () => {
    mermaid.initialize({
      startOnLoad: false,
      // 显式本地主题，避免任何外部引用
      theme: 'default',
      securityLevel: 'loose',
    })
  })

  it('120 节点流程图渲染耗时可接受（< 4.5s，happy-dom 环境敏感，真实验收以浏览器为准）', async () => {
    const code = genFlow(120)
    const t0 = performance.now()
    const { svg } = await mermaid.render('mmd-large', code)
    const elapsed = performance.now() - t0
    console.log(`S8 120 节点渲染: ${elapsed.toFixed(0)}ms, svg ${(svg.length / 1024).toFixed(0)}KB`)
    expect(elapsed).toBeLessThan(4500)
    expect(svg).toContain('<svg')
  })

  it('渲染产物无外部 CDN 引用（离线可用）', async () => {
    const code = genFlow(30)
    const { svg } = await mermaid.render('mmd-offline', code)
    const external = svg.match(/(?:href|xlink:href)="https?:/g)
    // SVG 内可能有 xmlns 命名空间但不该有 http 资源引用
    expect(external).toBeNull()
  })

  it('错误图表抛 ParseError（自研插件需 try/catch 兜底）', async () => {
    const bad = 'flowchart TD\n  A --> [unclosed'
    let threw = false
    try {
      await mermaid.render('mmd-bad', bad)
    } catch (e) {
      threw = true
      // mermaid 抛解析错误——自研 NodeView 渲染时必须捕获并显示降级提示
      expect(String(e)).toContain('Parse error')
    }
    expect(threw).toBe(true)
  })
})
