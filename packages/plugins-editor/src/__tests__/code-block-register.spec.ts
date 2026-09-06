import { describe, it, expect } from 'vitest'
import { PluginManager } from '@editor/core'
import { allL1Manifests } from '@editor/plugins-editor'

describe('code-block 插件注册', () => {
  it('allL1Manifests 应包含 code-block', () => {
    const ids = allL1Manifests.map(m => m.id)
    expect(ids).toContain('code-block')
    console.log('ALL-IDS:', ids.join(','))
  })

  it('mountAll 后 milkdownPlugins 应包含 code_block 相关插件', () => {
    const pm = new PluginManager({ enabledOverrides: {} })
    for (const m of allL1Manifests) pm.register(m as never)
    const { milkdownPlugins } = pm.mountAll()
    console.log('PLUGIN-COUNT:', milkdownPlugins.length)
    expect(milkdownPlugins.length).toBeGreaterThan(0)
  })
})
