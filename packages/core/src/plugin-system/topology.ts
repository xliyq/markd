/**
 * 拓扑排序（依赖解析）
 *
 * 依据 manifest.dependsOn 对插件排序，保证被依赖者先装载。
 * 算法：Kahn 算法 + 循环依赖检测。
 */
import type { AnyPluginManifest } from './manifest'

/** 循环依赖错误 */
export class CircularDependencyError extends Error {
  /** 检测到的环路径 */
  cycle: string[]

  constructor(cycle: string[]) {
    super(`Circular dependency detected: ${cycle.join(' -> ')}`)
    this.name = 'CircularDependencyError'
    this.cycle = cycle
  }
}

/** 未声明依赖错误 */
export class MissingDependencyError extends Error {
  constructor(id: string, missing: string) {
    super(`Plugin "${id}" depends on "${missing}" which is not registered`)
    this.name = 'MissingDependencyError'
  }
}

/**
 * 拓扑排序：返回按依赖顺序排列的 manifest id 列表。
 * 依赖的插件（dependsOn 中的 id）排在被依赖者之前。
 * @throws CircularDependencyError / MissingDependencyError
 */
export function topoSort(manifests: AnyPluginManifest[]): string[] {
  const byId = new Map<string, AnyPluginManifest>()
  for (const m of manifests) byId.set(m.id, m)

  // 校验所有依赖都已注册
  for (const m of manifests) {
    for (const dep of m.dependsOn) {
      if (!byId.has(dep)) throw new MissingDependencyError(m.id, dep)
    }
  }

  // Kahn 算法
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()
  for (const m of manifests) {
    inDegree.set(m.id, 0)
    adj.set(m.id, [])
  }
  // 边：被依赖者 -> 依赖者（被依赖者先出队）
  for (const m of manifests) {
    for (const dep of m.dependsOn) {
      adj.get(dep)!.push(m.id)
      inDegree.set(m.id, (inDegree.get(m.id) ?? 0) + 1)
    }
  }

  // FIFO 队列：保持「注册顺序稳定」——无依赖关系时按注册先后装载
  const queue: string[] = []
  for (const m of manifests) {
    if ((inDegree.get(m.id) ?? 0) === 0) queue.push(m.id)
  }

  const order: string[] = []
  const parent = new Map<string, string>()
  while (queue.length > 0) {
    const cur = queue.shift()!
    order.push(cur)
    for (const next of adj.get(cur)!) {
      parent.set(next, cur)
      const nd = (inDegree.get(next) ?? 0) - 1
      inDegree.set(next, nd)
      if (nd === 0) queue.push(next)
    }
  }

  if (order.length !== manifests.length) {
    // 有环：找环路径
    const remaining = new Set(
      [...inDegree.entries()].filter(([, d]) => d > 0).map(([id]) => id),
    )
    const cycle: string[] = []
    const start = remaining.values().next().value as string
    const visited = new Set<string>()
    let cur: string | undefined = start
    while (cur && !visited.has(cur)) {
      visited.add(cur)
      cycle.push(cur)
      // 找指向 cur 的依赖者（在 remaining 中）
      const deps: string[] = byId.get(cur)?.dependsOn ?? []
      const next: string | undefined = deps.find((d: string) => remaining.has(d))
      cur = next
    }
    // 归一化环的起点
    const idx = cycle.indexOf(cur ?? '')
    const normalized = idx > 0 ? [...cycle.slice(idx), ...cycle.slice(0, idx)] : cycle
    throw new CircularDependencyError(normalized.length ? normalized : [...remaining])
  }

  return order
}
