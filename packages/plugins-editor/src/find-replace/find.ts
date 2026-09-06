/**
 * 查找/替换（P1.4）
 *
 * 纯函数核心：在文档全文上定位查询串的所有匹配区间。
 * 正则转义 + 大小写可配；返回相对全文的 [from, to) 区间（与 ProseMirror doc 位置对齐，文本节点线性）。
 */
export interface MatchRange {
  from: number
  to: number
}

/** 转义正则特殊字符 */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 在全文上找所有匹配（非重叠，跳过空匹配）。
 */
export function findAllMatches(
  docText: string,
  query: string,
  opts: { caseInsensitive?: boolean } = {},
): MatchRange[] {
  if (!query) return []
  const flags = opts.caseInsensitive === false ? 'g' : 'gi'
  const re = new RegExp(escapeRegExp(query), flags)
  const results: MatchRange[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(docText)) !== null) {
    if (m[0].length === 0) {
      // 空匹配保护，防止死循环
      re.lastIndex++
      continue
    }
    results.push({ from: m.index, to: m.index + m[0].length })
  }
  return results
}

/**
 * 替换全部匹配（从后往前替换，避免位置漂移）。
 * @returns 替换次数
 */
export function replaceAllMatches(docText: string, matches: MatchRange[], replacement: string): string {
  let out = docText
  for (let i = matches.length - 1; i >= 0; i--) {
    const { from, to } = matches[i]
    out = out.slice(0, from) + replacement + out.slice(to)
  }
  return out
}

/** 下一个/上一个匹配索引（循环） */
export function stepMatchIndex(
  current: number,
  total: number,
  dir: 'next' | 'prev',
): number {
  if (total === 0) return -1
  if (current < 0) return dir === 'next' ? 0 : total - 1
  if (dir === 'next') return (current + 1) % total
  return (current - 1 + total) % total
}
