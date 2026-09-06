/**
 * Slash 命令菜单 manifest（P1）
 */
import { slashPlugin } from '../slash'
import type { MilkdownPluginManifest } from '@editor/core'
import { injectPluginStyle } from '../style-inject'
import slashStyle from './../slash/style.css?inline'

export const slashMenuManifest: MilkdownPluginManifest = {
  id: 'slash-menu',
  type: 'milkdown',
  name: 'Slash 菜单',
  version: '1.0.0',
  description: '输入 / 唤起命令面板（标题/引用/代码块/表格/图片等 12 项）',
  dependsOn: ['commonmark', 'tooltip'],
  defaultEnabled: true,
  create: () => {
    injectPluginStyle("slash", slashStyle)
    return slashPlugin
  },
}
