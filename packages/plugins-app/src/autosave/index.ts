/**
 * 自动保存（M1.6/M7.1）
 *
 * L2 模块：监听 Markdown 变更 → 防抖落库（saveDocContent）。
 * 保存时机：内容变化后 800ms 防抖；额外提供立即 flush。
 */
import type { AppModuleManifest, AppApi } from '@editor/core'

/** 自动保存防抖窗口（ms） */
export const AUTOSAVE_DEBOUNCE_MS = 800

export function createAutosaveModule(api: AppApi) {
  const { storage: st } = api
  if (!st) throw new Error('[autosave] AppApi 未注入 storage')

  let timer: ReturnType<typeof setTimeout> | null = null
  let dirtyDocId: string | null = null
  const latest = new Map<string, string>()
  /** 事件订阅取消函数（dispose 时清理） */
  let offEvent: (() => void) | undefined

  /** 文档内容变更回调（由应用层绑定到 editor 的 onChange） */
  function onDocChange(docId: string, markdown: string): void {
    latest.set(docId, markdown)
    dirtyDocId = docId
    if (timer) clearTimeout(timer)
    timer = setTimeout(async () => {
      timer = null
      if (dirtyDocId) {
        const md = latestMarkdown(dirtyDocId)
        await flush(dirtyDocId, md)
        dirtyDocId = null
      }
    }, AUTOSAVE_DEBOUNCE_MS)
  }

  /** 立即落库（切换文档/关闭前调用；markdown 由调用方传入） */
  async function flush(docId: string, markdown: string): Promise<void> {
    // 闭包内 TS 不保留对可选引用的窄化，这里显式取回（双保险）
    const s = api.storage
    if (!s) throw new Error('[autosave] storage 未注入')
    await s.saveDocContent({ id: docId, content: markdown })
  }

  function latestMarkdown(docId: string): string {
    return latest.get(docId) ?? ''
  }

  function stopWaiting(): void {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  /** 订阅 AppApi 事件总线上的 doc:changed（bootstrap 从 editor onChange 转发） */
  function subscribe(): void {
    offEvent = api.on?.('doc:changed', (payload: unknown) => {
      const p = payload as { docId: string; markdown: string }
      if (p?.docId) onDocChange(p.docId, p.markdown)
    })
  }

  return {
    onDocChange,
    flush,
    latestMarkdown,
    subscribe,
    dispose() {
      offEvent?.()
      stopWaiting()
    },
  }
}

export const autosaveManifest: AppModuleManifest = {
  id: 'autosave',
  type: 'app',
  name: '自动保存',
  version: '1.0.0',
  description: '内容变更防抖自动保存（800ms）',
  dependsOn: [],
  defaultEnabled: true,
  mount: (api) => {
    const mod = createAutosaveModule(api)
    ;(api as unknown as Record<string, unknown>).autosave = mod
    mod.subscribe()
    return { name: '自动保存', dispose: () => mod.dispose() }
  },
}
