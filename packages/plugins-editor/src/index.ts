/**
 * @editor/plugins-editor —— L1 编辑器插件集合
 *
 * 每个插件一个能力域目录，导出 manifest（04 §5 约定）。
 * 入口聚合全部 manifest，供 apps/editor 装配时批量注册。
 */
import type { MilkdownPluginManifest } from '@editor/core'
import { commonmarkManifest } from './commonmark'
import { gfmManifest } from './gfm'
import { tableManifest } from './table'
import { imageManifest } from './image'
import { themeNordManifest } from './theme-nord'
import { tooltipManifest } from './tooltip'
import { slashMenuManifest } from './slash-menu'
import { findReplaceManifest } from './find-replace-manifest'
import { codeBlockManifest } from './code-block'
import { blockManifest } from './block'
import { trailingManifest } from './trailing'
import { markdownPasteManifest } from './markdown-paste'
import { historyManifest } from './history'

export { commonmarkManifest } from './commonmark'
export { gfmManifest } from './gfm'
export { tableManifest } from './table'
export { imageManifest } from './image'
export { themeNordManifest } from './theme-nord'
export { tooltipManifest } from './tooltip'
export { slashMenuManifest } from './slash-menu'
export { findReplaceManifest } from './find-replace-manifest'
export { codeBlockManifest } from './code-block'
export { blockManifest } from './block'
export { getFindReplace } from './find-replace'
export { bindCommands, runCommand, setTextPrompt, requestText, setLinkPrompt, requestLink, setImagePrompt, requestImage } from './toolbar/command-bridge'
export { runToolbarAction } from './toolbar/commands'
export type { ToolbarAction } from './toolbar/commands'
export { markdownPasteManifest } from './markdown-paste'
export { historyManifest } from './history'
export { imageConfig } from './image'

/** 全部 L1 插件 manifest（装配时逐一注册） */
export const allL1Manifests: MilkdownPluginManifest[] = [
  commonmarkManifest,
  gfmManifest,
  tableManifest,
  imageManifest,
  themeNordManifest,
  tooltipManifest,
  slashMenuManifest,
  findReplaceManifest,
  codeBlockManifest,
  blockManifest,
  trailingManifest,
  markdownPasteManifest,
  historyManifest,
]
