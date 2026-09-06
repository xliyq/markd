// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { createDataSafetyModule } from '../data-safety'
import type { DataSafetyModule, DataSafetyEnv } from '../data-safety'

/**
 * Phase 2 —— 数据安全单测（M7.5）：
 * beforeunload 拦截（未保存时阻止关闭）、脏状态标记、多标签冲突检测。
 * 用注入的 fake 环境（无真实 window/BroadcastChannel），纯逻辑验证。
 */

function fakeEnv(onBeforeUnload?: (e: unknown) => void): DataSafetyEnv & {
  posted: unknown[]
  delivered: ((msg: unknown) => void)[]
} {
  const posted: unknown[] = []
  const delivered: ((msg: unknown) => void)[] = []
  return {
    addBeforeUnload: onBeforeUnload
      ? (fn) => { /* 直接注入原语事件处理器，稍后手动触发用 delivered 模拟 */ }
      : undefined,
    broadcast: {
      post: (msg) => posted.push(msg),
      onMessage: (fn) => delivered.push(fn),
      close: () => {},
    },
    posted,
    delivered,
  }
}

/** 构造最小 AppApi，注入 data-safety 并返回 env */
function setup() {
  const env = fakeEnv()
  const api = {} as never
  const mod = createDataSafetyModule(api, env)
  return { mod, env }
}

describe('data-safety 数据安全', () => {
  describe('未保存关闭防护（beforeunload 拦截）', () => {
    it('有未保存内容时 beforeunload 触发 preventDefault', () => {
      let handler: ((e: unknown) => void) | undefined
      const env: DataSafetyEnv = {
        addBeforeUnload: (fn) => { handler = fn },
      }
      const mod = createDataSafetyModule({} as never, env)

      mod.setCurrentDoc('doc-1')
      mod.markDirty('doc-1')

      const ev = { preventDefault: vi.fn(), returnValue: 'x' }
      handler?.(ev)
      expect(ev.preventDefault).toHaveBeenCalled()
      expect(ev.returnValue).toBe('')
    })

    it('已保存后 beforeunload 不拦截', () => {
      let handler: ((e: unknown) => void) | undefined
      const env: DataSafetyEnv = { addBeforeUnload: (fn) => { handler = fn } }
      const mod = createDataSafetyModule({} as never, env)

      mod.setCurrentDoc('doc-1')
      mod.markDirty('doc-1')
      mod.markSaved('doc-1')

      const ev = { preventDefault: vi.fn(), returnValue: 'x' }
      handler?.(ev)
      expect(ev.preventDefault).not.toHaveBeenCalled()
    })
  })

  describe('脏状态管理', () => {
    it('isDirty 反映当前文档未保存状态', () => {
      const { mod } = setup()
      mod.setCurrentDoc('doc-1')
      expect(mod.isDirty()).toBe(false)
      mod.markDirty('doc-1')
      expect(mod.isDirty()).toBe(true)
      mod.markSaved('doc-1')
      expect(mod.isDirty()).toBe(false)
    })
  })

  describe('多标签冲突检测（BroadcastChannel）', () => {
    it('同文档被其他标签保存 → 触发冲突回调', () => {
      const { mod, env } = setup()
      const onConflict = vi.fn()
      mod.onConflict((p) => { onConflict(p.docId, p.contentHash) })

      mod.setCurrentDoc('doc-1')
      // 模拟另一标签广播保存事件
      env.delivered[0]?.({ kind: 'saved', docId: 'doc-1', contentHash: 'hash-X', at: 123 })
      expect(onConflict).toHaveBeenCalledWith('doc-1', 'hash-X')
    })

    it('其他文档被保存 → 不触发冲突', () => {
      const { mod, env } = setup()
      const onConflict = vi.fn()
      mod.onConflict(onConflict)
      mod.setCurrentDoc('doc-1')
      env.delivered[0]?.({ kind: 'saved', docId: 'doc-2', contentHash: 'h', at: 1 })
      expect(onConflict).not.toHaveBeenCalled()
    })

    it('本地保存 → 广播 saved 事件（供其他标签检测）', () => {
      const { mod, env } = setup()
      mod.broadcastSaved('doc-1', 'hash-1')
      expect(env.posted).toEqual([
        { kind: 'saved', docId: 'doc-1', contentHash: 'hash-1', at: expect.any(Number) },
      ])
    })
  })

  describe('dispose 清理', () => {
    it('dispose 后不再触发冲突回调', () => {
      const { mod, env } = setup()
      const onConflict = vi.fn()
      mod.onConflict(onConflict)
      mod.dispose()
      env.delivered[0]?.({ kind: 'saved', docId: 'doc-1', contentHash: 'h', at: 1 })
      expect(onConflict).not.toHaveBeenCalled()
    })
  })
})
