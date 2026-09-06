/**
 * 文档末尾补空段（@milkdown/plugin-trailing）
 *
 * 解决：「文档末尾为表格 / 代码块 / 图片等不可继续编辑的节点时，
 *       末尾点击无法落光标、无法继续输入」的问题。
 *
 * 实现：使用官方 @milkdown/plugin-trailing，强制文档末尾始终保持一个空段落。
 *      思路：当 lastNode 不是 heading/paragraph 时自动追加一个 paragraph。
 */
import { trailing, trailingConfig } from '@milkdown/plugin-trailing'
import type { MilkdownPluginManifest } from '@editor/core'
import type { MilkdownPlugin } from '@milkdown/ctx'

const configureTrailingPlugin: MilkdownPlugin = (ctx) => {
  // 沿用默认配置：heading / paragraph 不追加，其余节点追加空段落
  ctx.update(trailingConfig.key, (defaultConfig) => ({
    ...defaultConfig,
  }))
  return () => {}
}

export const trailingManifest: MilkdownPluginManifest = {
  id: 'trailing',
  type: 'milkdown',
  name: '末尾光标补位',
  version: '1.0.0',
  description: '文档末尾追加空段落，确保任意节点后都能落光标继续输入',
  dependsOn: ['commonmark'],
  defaultEnabled: true,
  // trailing 数组先注册 trailingConfig slice，configure 紧随其后
  create: () => [...trailing, configureTrailingPlugin],
}
