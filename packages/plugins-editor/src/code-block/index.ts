/**
 * 代码块组件（官方 codeBlockComponent：CodeMirror 内核）
 *
 * 效果对齐官方 Crepe 的 CodeMirror feature：
 *   - 行号、代码折叠、补全、键盘快捷键（basicSetup 等价组成）
 *   - 语法高亮（主题化 HighlightStyle，颜色经 CSS 变量适配明暗主题）
 *   - 语言选择器 + 复制按钮 + 复制成功提示（codeBlockComponent 自带 + onCopy）
 * 逐项组合 extension，避免引入 codemirror 全家桶包的 dev 预构建问题。
 */
import {
  codeBlockComponent,
  codeBlockConfig,
} from '@milkdown/kit/component/code-block'
import { defaultKeymap, indentWithTab, history } from '@codemirror/commands'
import {
  keymap,
  lineNumbers,
  highlightSpecialChars,
  drawSelection,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
} from '@codemirror/view'
import {
  syntaxHighlighting,
  HighlightStyle,
  defaultHighlightStyle,
  bracketMatching,
  indentOnInput,
  foldGutter,
  foldKeymap,
} from '@codemirror/language'
import { autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { languages } from '@codemirror/language-data'
import { tags } from '@lezer/highlight'
import type { MilkdownPlugin } from '@milkdown/ctx'
import type { MilkdownPluginManifest } from '@editor/core'
import { injectPluginStyle } from '../style-inject'
import codeBlockStyle from './style.css?inline'

/**
 * 主题化语法高亮样式。
 * 颜色全部用 CSS 变量（--code-*），由 code-block.css 按 html[data-theme] 适配明暗。
 * 比 defaultHighlightStyle（固定亮色）更符合应用主题体系。
 */
const themedHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--code-kw)' },
  { tag: [tags.name, tags.deleted, tags.character, tags.propertyName, tags.macroName], color: 'var(--code-name)' },
  { tag: [tags.function(tags.variableName), tags.labelName], color: 'var(--code-fn)' },
  { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: 'var(--code-const)' },
  { tag: [tags.definition(tags.name), tags.separator], color: 'var(--code-def)' },
  { tag: [tags.typeName, tags.className, tags.number, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace], color: 'var(--code-type)' },
  { tag: [tags.operator, tags.operatorKeyword, tags.url, tags.escape, tags.regexp, tags.link, tags.special(tags.string)], color: 'var(--code-op)' },
  { tag: [tags.meta, tags.comment], color: 'var(--code-comment)' },
  { tag: [tags.strong], fontWeight: 'bold' },
  { tag: [tags.emphasis], fontStyle: 'italic' },
  { tag: [tags.strikethrough], textDecoration: 'line-through' },
  { tag: [tags.link], color: 'var(--code-op)', textDecoration: 'underline' },
  { tag: [tags.heading], fontWeight: 'bold', color: 'var(--code-def)' },
  { tag: [tags.string], color: 'var(--code-string)' },
  { tag: [tags.atom, tags.bool, tags.special(tags.variableName)], color: 'var(--code-const)' },
  { tag: [tags.processingInstruction, tags.inserted], color: 'var(--code-fn)' },
  { tag: [tags.invalid], textDecoration: 'underline wavy red' },
])

/** 与官方 basicSetup 等价的功能组合（不含 lint / 搜索 keymap，保持轻量） */
const editorExtensions = [
  lineNumbers(),
  highlightSpecialChars(),
  history(),
  foldGutter(),
  drawSelection(),
  indentOnInput(),
  // 用主题化高亮样式替换 defaultHighlightStyle
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  syntaxHighlighting(themedHighlightStyle),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  rectangularSelection(),
  crosshairCursor(),
  highlightActiveLine(),
  highlightActiveLineGutter(),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...foldKeymap,
    indentWithTab,
  ]),
]

/** 复制成功 → 派发全局事件，App 层监听弹提示 */
function notifyCopied() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('milkdown:code-copied'))
}

/** 配置插件：注入编辑 extension + 全量语言 + 复制回调（先于 codeBlockComponent 执行） */
const configureCodeBlockPlugin: MilkdownPlugin = (ctx) => {
  ctx.update(codeBlockConfig.key, (defaultConfig) => ({
    ...defaultConfig,
    extensions: editorExtensions,
    languages,
    copyText: '复制',
    onCopy: notifyCopied,
  }))
  return () => {}
}

export const codeBlockManifest: MilkdownPluginManifest = {
  id: 'code-block',
  type: 'milkdown',
  name: '代码块组件',
  version: '1.0.0',
  description: '代码块：语言选择 + 主题化语法高亮 + 行号 + 复制按钮（对齐官方 Crepe）',
  dependsOn: ['commonmark'],
  defaultEnabled: true,
  create: () => {
    injectPluginStyle("code-block", codeBlockStyle)
    return [...codeBlockComponent, configureCodeBlockPlugin]
  },
}
