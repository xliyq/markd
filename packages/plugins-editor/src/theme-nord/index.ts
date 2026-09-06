/**
 * Nord 主题（M6.1）
 *
 * nord 是 (ctx)=>void 函数（官方导出），包一层 MilkdownPlugin 适配器（S1 验证）。
 */
import { nord } from '@milkdown/theme-nord'
import type { MilkdownPluginManifest } from '@editor/core'
import type { MilkdownPlugin } from '@milkdown/ctx'
import { injectPluginStyle } from '../style-inject'
import editorStyle from './editor.css?inline'
import nordOfficial from '@milkdown/theme-nord/style.css?inline'

/** nord 主题适配器：setup 阶段调用 nord(ctx)，返回空 cleanup */
const nordThemePlugin: MilkdownPlugin = (ctx) => {
  nord(ctx)
  return () => {}
}

export const themeNordManifest: MilkdownPluginManifest = {
  id: 'theme-nord',
  type: 'milkdown',
  name: 'Nord 主题',
  version: '1.0.0',
  description: 'Nord 配色主题（类 Typora 清爽风）',
  dependsOn: ['commonmark'],
  defaultEnabled: true,
  create: () => {
    injectPluginStyle("theme-nord", editorStyle)
    injectPluginStyle("theme-nord-official", nordOfficial)
    return nordThemePlugin
  },
}
