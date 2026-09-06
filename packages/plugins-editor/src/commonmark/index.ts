/**
 * commonmark 基础语法（M0.1）
 *
 * Milkdown preset-commonmark 的 manifest 封装：Grammar 基础，
 * 是 gfm 等后续语法插件的依赖。
 */
import { commonmark } from '@milkdown/kit/preset/commonmark'
import type { MilkdownPluginManifest } from '@editor/core'

export const commonmarkManifest: MilkdownPluginManifest = {
  id: 'commonmark',
  type: 'milkdown',
  name: 'CommonMark 基础语法',
  version: '1.0.0',
  description: '标题、粗斜、引用、列表、链接、图片等基础 Markdown 语法',
  dependsOn: [],
  defaultEnabled: true,
  create: () => commonmark,
}
