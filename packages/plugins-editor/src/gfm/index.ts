/**
 * GFM 扩展语法（M0.1 / M5 表格）
 *
 * 含表格 schema（S3 结论：gfm 提供 table schema，table-block 提供渲染 view）。
 * 依赖 commonmark。
 */
import { gfm } from '@milkdown/kit/preset/gfm'
import type { MilkdownPluginManifest } from '@editor/core'

export const gfmManifest: MilkdownPluginManifest = {
  id: 'gfm',
  type: 'milkdown',
  name: 'GFM 扩展语法',
  version: '1.0.0',
  description: '任务列表、删除线、自动链接、表格 schema 等 GFM 语法',
  dependsOn: ['commonmark'],
  defaultEnabled: true,
  create: () => gfm,
}
