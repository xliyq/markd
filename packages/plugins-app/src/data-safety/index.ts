/**
 * 数据安全（M7.5）
 *
 * 1. 未保存关闭防护：beforeunload 拦截（有未保存内容时浏览器弹确认）；
 * 2. 多标签冲突检测：BroadcastChannel 广播保存事件，同文档多标签写入冲突提示。
 *
 * 设计：纯逻辑核心（DataSafetyCore）+ 环境适配（window/channel 由调用方注入），
 * 保证 Node 单测可跑；浏览器能力由应用壳装配。
 */
import type { AppModuleManifest, AppApi } from '@editor/core'

/** 环境适配（测试注入 fake，浏览器用真实） */
export interface DataSafetyEnv {
  /** beforeunload 监听（undefined = 无浏览器环境，自动降级） */
  addBeforeUnload?: (fn: (e: unknown) => void) => void
  /** BroadcastChannel（undefined = 不支持，冲突检测降级） */
  broadcast?: {
    post: (msg: unknown) => void
    onMessage: (fn: (msg: unknown) => void) => void
    close: () => void
  }
}

export interface DataSafetyModule {
  /** 是否有未保存内容（beforeunload 判断依据） */
  isDirty: () => boolean
  /** 标记当前文档未保存（autosave 更新时调用） */
  markDirty: (docId: string) => void
  /** 标记已保存（落库成功后调用） */
  markSaved: (docId: string) => void
  /** 广播一次保存事件（落库成功后调用） */
  broadcastSaved: (docId: string, contentHash: string) => void
  /** 监听冲突（其他标签保存同一文档） */
  onConflict: (fn: (payload: { docId: string; contentHash: string; at: number }) => void) => () => void
  /** 当前打开文档（由应用壳设置） */
  setCurrentDoc: (docId: string | null) => void
  dispose: () => void
}

interface SaveEvent {
  kind: 'saved'
  docId: string
  contentHash: string
  at: number
}

export function createDataSafetyModule(api: AppApi, env: DataSafetyEnv = {}): DataSafetyModule {
  /** 脏文档集合：{ docId: true }（未保存内容） */
  const dirty = new Set<string>()
  /** 当前打开的文档（冲突检测只关心它） */
  let currentDoc = ''
  const conflictListeners = new Set<(p: { docId: string; contentHash: string; at: number }) => void>()
  const offs: (() => void)[] = []

  // ---- beforeunload 拦截 ----
  if (env.addBeforeUnload) {
    env.addBeforeUnload((e: unknown) => {
      if (dirty.size > 0 && currentDoc && dirty.has(currentDoc)) {
        // 浏览器约定：preventDefault 或 returnValue 触发确认弹窗
        const ev = e as { preventDefault: () => void; returnValue?: string }
        ev.preventDefault()
        ev.returnValue = ''
      }
    })
  }

  // ---- BroadcastChannel 冲突检测 ----
  if (env.broadcast) {
    env.broadcast.onMessage((raw) => {
      const msg = raw as SaveEvent
      if (msg?.kind !== 'saved') return
      // 别的标签保存了我们当前打开的文档 → 有写入竞争
      if (msg.docId === currentDoc && currentDoc) {
        for (const fn of conflictListeners) fn({ docId: msg.docId, contentHash: msg.contentHash, at: msg.at })
      }
    })
    offs.push(() => env.broadcast?.close())
  }

  return {
    isDirty: () => (currentDoc ? dirty.has(currentDoc) : dirty.size > 0),
    markDirty: (docId) => {
      dirty.add(docId)
    },
    markSaved: (docId) => {
      dirty.delete(docId)
    },
    broadcastSaved: (docId, contentHash) => {
      env.broadcast?.post({ kind: 'saved', docId, contentHash, at: Date.now() })
    },
    onConflict: (fn) => {
      conflictListeners.add(fn)
      return () => conflictListeners.delete(fn)
    },
    setCurrentDoc: (docId) => {
      currentDoc = docId ?? ''
    },
    dispose: () => {
      offs.forEach((off) => off())
      conflictListeners.clear()
      dirty.clear()
    },
  }
}

export const dataSafetyManifest: AppModuleManifest = {
  id: 'data-safety',
  type: 'app',
  name: '数据安全',
  version: '1.0.0',
  description: 'beforeunload 未保存防护 + 多标签写入冲突检测（M7.5）',
  dependsOn: [],
  defaultEnabled: true,
  mount: (api) => {
    const mod = createDataSafetyModule(api)
    ;(api as unknown as Record<string, unknown>).dataSafety = mod
    return { name: '数据安全', dispose: () => mod.dispose() }
  },
}
