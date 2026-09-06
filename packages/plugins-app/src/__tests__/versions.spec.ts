// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { DexieStorageProvider } from '@editor/infra'
import { createVersionsModule } from '../versions'
import { AUTOSAVE_KEEP } from '../versions'

/**
 * Phase 5 —— 版本快照单测（M2.4/M7.6）：
 * 快照创建（manual/autosave）、恢复写回、自动保存 trim 保留策略。
 */

describe('versions 版本快照', () => {
  let storage: DexieStorageProvider
  let versions: ReturnType<typeof createVersionsModule>

  // 简单事件总线
  let listeners: Record<string, ((p: unknown) => void)[]>
  const api = {
    on: (evt: string, fn: (p: unknown) => void) => {
      listeners[evt] = listeners[evt] || []
      listeners[evt].push(fn)
      return () => { listeners[evt] = (listeners[evt] || []).filter((f) => f !== fn) }
    },
    emit: (evt: string, p: unknown) => { (listeners[evt] || []).forEach((f) => f(p)) },
  }

  beforeAll(() => {
    listeners = {}
    storage = new DexieStorageProvider()
    versions = createVersionsModule({ storage, on: api.on, emit: api.emit } as never)
    versions.subscribe()
  })
  afterAll(() => storage.dispose())

  beforeEach(async () => {
    const db = (storage as unknown as { db: { versions: { clear: () => Promise<void> }; docs: { clear: () => Promise<void> } } }).db
    await Promise.all([db.versions.clear(), db.docs.clear()])
  })

  it('manual 快照创建并读出', async () => {
    await versions.snapshot('d1', '# v1', 'manual')
    const list = await versions.list('d1')
    expect(list).toHaveLength(1)
    expect(list[0].reason).toBe('manual')
    expect(list[0].content).toBe('# v1')
  })

  it('subscribe 后 doc:changed 自动打 autosave 快照', async () => {
    api.emit('doc:changed', { docId: 'd1', markdown: '# auto' })
    // 快照异步执行，等一拍
    await new Promise((r) => setTimeout(r, 20))
    const list = await versions.list('d1')
    expect(list).toHaveLength(1)
    expect(list[0].reason).toBe('autosave')
  })

  it('restore 把版本写回 docs 并广播 doc:restored', async () => {
    await storage.saveDocContent({ id: 'd1', content: '# 当前' })
    await versions.snapshot('d1', '# 历史版本', 'manual')
    let restored = false
    listeners['doc:restored'] = listeners['doc:restored'] || []
    listeners['doc:restored'].push(() => { restored = true })

    const ok = await versions.restore('d1', (await versions.list('d1'))[0].id)
    expect(ok).toBe(true)
    const doc = await storage.getDocContent('d1')
    expect(doc?.content).toBe('# 历史版本')
    expect(restored).toBe(true)
  })

  it('自动保存快照超过保留上限被 trim', async () => {
    // 打 AUTOSAVE_KEEP + 5 条 autosave 快照
    for (let i = 0; i < AUTOSAVE_KEEP + 5; i++) {
      await versions.snapshot('d1', `# v${i}`, 'autosave')
    }
    const list = await versions.list('d1')
    expect(list.length).toBeLessThanOrEqual(AUTOSAVE_KEEP)
  })

  it('manual 快照不受 autosave trim 影响', async () => {
    for (let i = 0; i < 25; i++) {
      await versions.snapshot('d1', `# a${i}`, 'autosave')
    }
    await versions.snapshot('d1', '# 手动珍贵', 'manual')
    const list = await versions.list('d1')
    expect(list.some((v) => v.content === '# 手动珍贵')).toBe(true)
  })
})
