/**
 * 撤销/重做（history）
 *
 * 官方 @milkdown/plugin-history（prosemirror-history）：Ctrl+Z 撤销 / Ctrl+Shift+Z 重做。
 * 此前已安装但从未注册 → Ctrl+Z 无效。独立 manifest，默认开启。
 */
import { history } from '@milkdown/kit/plugin/history'
import type { MilkdownPluginManifest } from '@editor/core'

export const historyManifest: MilkdownPluginManifest = {
  id: 'history',
  type: 'milkdown',
  name: '撤销/重做',
  version: '1.0.0',
  description: 'Ctrl+Z 撤销 / Ctrl+Shift+Z 重做（官方 prosemirror-history）',
  dependsOn: ['commonmark'],
  defaultEnabled: true,
  create: () => history,
}
