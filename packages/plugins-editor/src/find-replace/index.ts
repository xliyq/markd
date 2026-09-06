/**
 * 查找/替换插件（P1.4）
 *
 * $prose：在编辑器文档上扫描查询串 → Decoration 高亮全部匹配，
 * 当前匹配高亮强化 + 选区跳转；提供 replaceCurrent / replaceAll。
 *
 * 设计说明：doc 文本经 textBetween 线性提取，匹配区间即 doc 位置（文本节点）。
 * 高亮用 Decoration.inline，当前项加深；替换用 tr.insertText。
 */
import { Plugin, PluginKey, TextSelection } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'
import { $prose } from '@milkdown/utils'
import type { Ctx } from '@milkdown/ctx'
import { findAllMatches, stepMatchIndex, type MatchRange } from './find'

const key = new PluginKey('MILKDOWN_FIND_REPLACE')

export interface FindReplaceController {
  find: (query: string) => number
  next: () => void
  prev: () => void
  replaceCurrent: (replacement: string) => boolean
  replaceAll: (replacement: string) => number
  clear: () => void
}

let activeController: FindReplaceController | null = null

export function getFindReplace(): FindReplaceController | null {
  return activeController
}

export const findReplace = $prose((ctx: Ctx) => {
  let query = ''
  let matches: MatchRange[] = []
  let currentIdx = -1
  let currentView: { dispatch: (tr: unknown) => void; state: { doc: unknown; tr: unknown; selection: unknown } } | null = null

  let decorations: DecorationSet = DecorationSet.empty

  const plugin = new Plugin({
    key,
    state: {
      init: () => DecorationSet.empty,
      apply: (tr, old) => {
        if (tr.getMeta(key)) {
          return (tr.getMeta(key) as DecorationSet) ?? old
        }
        return old.map(tr.mapping, tr.doc)
      },
    },
    props: {
      decorations: (state) => {
        const v = plugin.getState(state) as DecorationSet
        return v
      },
    },
    view: (view) => {
      currentView = view as never
      return { update: () => {}, destroy: () => {} }
    },
  })

  function sync(view: never) {
    void view
    // 更新高亮（先空实现，装饰重建在主方法内）
  }

  activeController = {
    find(queryText: string): number {
      query = queryText
      if (!query) {
        matches = []
        currentIdx = -1
        if (currentView) currentView.dispatch((currentView.state as never) as never)
        return 0
      }
      const view = currentView
      if (!view) return 0
      const state = view.state as unknown as { doc: { textBetween: (a: number, b: number, s: string) => string } }
      const text = state.doc.textBetween(0, (state.doc as unknown as { content: { size: number } }).content.size, '\n')
      matches = findAllMatches(text, query)
      currentIdx = matches.length > 0 ? 0 : -1
      applyDecorations()
      jumpToCurrent()
      return matches.length
    },
    next() {
      currentIdx = stepMatchIndex(currentIdx, matches.length, 'next')
      applyDecorations()
      jumpToCurrent()
    },
    prev() {
      currentIdx = stepMatchIndex(currentIdx, matches.length, 'prev')
      applyDecorations()
      jumpToCurrent()
    },
    replaceCurrent(replacement: string): boolean {
      if (currentIdx < 0 || currentIdx >= matches.length) return false
      const view = currentView
      if (!view) return false
      const m = matches[currentIdx]
      const st = view.state as unknown as { tr: { insertText: (t: string, a: number, b: number) => unknown } }
      const tr = st.tr.insertText(replacement, m.from, m.to)
      view.dispatch(tr as never)
      // 重新查找（区间变化）
      const count = activeController!.find(query)
      return count > 0
    },
    replaceAll(replacement: string): number {
      const view = currentView
      if (!view || matches.length === 0) return 0
      // 从后往前替换避免位置漂移（Transaction 可变，连续 insertText）
      const st = view.state as { tr: { insertText: (t: string, a: number, b: number) => unknown } }
      let tr = st.tr as { insertText: (t: string, a: number, b: number) => unknown }
      for (let i = matches.length - 1; i >= 0; i--) {
        tr = tr.insertText(replacement, matches[i].from, matches[i].to) as never
      }
      view.dispatch(tr as never)
      const count = matches.length
      activeController!.clear()
      return count
    },
    clear() {
      query = ''
      matches = []
      currentIdx = -1
      if (currentView) {
        const st = currentView.state as unknown as { tr: { setMeta: (k: unknown, v: unknown) => unknown } }
        const tr = st.tr.setMeta(key, DecorationSet.empty)
        currentView.dispatch(tr as never)
      }
    },
  }

  function applyDecorations() {
    if (!currentView) return
    const state = currentView.state as unknown as { doc: unknown; tr: { setMeta: (k: unknown, v: unknown) => unknown } }
    const decos = matches.map((m, i) => {
      const cls = i === currentIdx ? 'find-current' : 'find-match'
      return Decoration.inline(m.from, m.to, { class: cls })
    })
    decorations = DecorationSet.create(state.doc as never, decos)
    const tr = state.tr.setMeta(key, decorations)
    currentView.dispatch(tr as never)
  }

  function jumpToCurrent() {
    if (!currentView || currentIdx < 0 || currentIdx >= matches.length) return
    const m = matches[currentIdx]
    const st = currentView.state as unknown as {
      doc: { resolve: (p: number) => unknown }
      tr: { setSelection: (s: unknown) => unknown }
    }
    const $pos = st.doc.resolve(m.from)
    const sel = TextSelection.create(st.doc as never, m.from, m.to)
    const tr = st.tr.setSelection(sel)
    currentView.dispatch(tr as never)
    void $pos
  }

  void sync
  return plugin
})

export default findReplace
