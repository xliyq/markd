/**
 * 查找/替换 manifest（P1.4）
 */
import { findReplace } from '../find-replace'
import type { MilkdownPluginManifest } from '@editor/core'
import { injectPluginStyle } from '../style-inject'
import findStyle from '../find-replace/style.css?inline'

export const findReplaceManifest: MilkdownPluginManifest = {
  id: 'find-replace',
  type: 'milkdown',
  name: '查找替换',
  version: '1.0.0',
  description: 'Ctrl+F 查找/替换（高亮 + 跳转 + 替换当前/全部）',
  dependsOn: ['commonmark'],
  defaultEnabled: true,
  create: () => {
    injectPluginStyle("find-replace", findStyle)
    return [findReplace]
  },
}
