/**
 * 表格交互（M5）
 *
 * components/table-block 提供 NodeView 渲染 + 行列操作 UI（S3 验证）。
 * 依赖 gfm（schema 来源）。主题化按钮在此配置。
 *
 * renderButton 对齐官方默认值（@milkdown/components table-block/config.ts）：
 * add_row/add_col → '+'；delete → '-'；col/row_drag_handle → '='（胶囊拖拽纹理）
 */
import { tableBlock, tableBlockConfig } from '@milkdown/kit/component/table-block'
import { tableExchange } from '../table-exchange'
import type { MilkdownPluginManifest } from '@editor/core'
import { injectPluginStyle } from '../style-inject'
import tableStyle from './style.css?inline'
import type { MilkdownPlugin } from '@milkdown/ctx'

const renderButton = (renderType: string): string => {
  switch (renderType) {
    case 'add_row':
      return '+'
    case 'add_col':
      return '+'
    case 'delete_row':
      return '-'
    case 'delete_col':
      return '-'
    case 'align_col_left':
      return '左'
    case 'align_col_center':
      return '中'
    case 'align_col_right':
      return '右'
    case 'col_drag_handle':
      return '='
    case 'row_drag_handle':
      return '='
    default:
      return ''
  }
}

/** 表格按钮主题化配置插件（$Ctx 需在 setup 阶段覆盖） */
const tableConfigPlugin: MilkdownPlugin = (ctx) => {
  ctx.set(tableBlockConfig.key, { renderButton })
  return () => {}
}

export const tableManifest: MilkdownPluginManifest = {
  id: 'table',
  type: 'milkdown',
  name: '表格',
  version: '1.0.0',
  description: 'GFM 表格渲染 + 行列操作/对齐/拖拽（官方 table-block）',
  dependsOn: ['gfm'],
  defaultEnabled: true,
  create: () => {
    injectPluginStyle("table", tableStyle)
    return [
      // tableBlock 先 setup（注入 tableBlockConfig $Ctx），配置插件必须在其后（setup 顺序依赖）
      ...tableBlock,
      tableConfigPlugin,
      // M5.5 数据交换：Excel/CSV 粘贴 → Markdown 表格（handlePaste 拦截）
      tableExchange,
    ]
  },
}
