/**
 * 文档统计（P1.4：大纲 + 字数）
 *
 * 纯函数服务：从 Markdown 原文提取标题树（大纲）与字数统计。
 * 供 App.vue 状态栏/大纲面板调用；不依赖 milkdown，可在任意环境测试。
 */

export interface OutlineItem {
  level: number
  text: string
  /** markdown 锚点（GitHub 风格：小写、空格转 -、去标点） */
  anchor: string
  /** 在文档中的行号（1-based） */
  line: number
}

export interface DocStats {
  /** 总字符数（不计空白） */
  chars: number
  /** 中文字符数 */
  cjkChars: number
  /** 英文单词数 */
  words: number
  /** 总行数 */
  lines: number
  /** 标题数 */
  headings: number
}

/** 提取标题行：`#{1,6} text` */
const HEADING_RE = /^(#{1,6})\s+(.+)$/

/** GitHub 风格锚点 */
export function toAnchor(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
}

/** 解析 Markdown 大纲（标题树） */
export function parseOutline(markdown: string): OutlineItem[] {
  const items: OutlineItem[] = []
  const lines = markdown.split(/\r?\n/)
  lines.forEach((line, idx) => {
    const m = HEADING_RE.exec(line.trim())
    if (m) {
      items.push({
        level: m[1].length,
        text: m[2].trim(),
        anchor: toAnchor(m[2].trim()),
        line: idx + 1,
      })
    }
  })
  return items
}

/** 统计字数 */
export function countStats(markdown: string): DocStats {
  const lines = markdown.split(/\r?\n/)
  const cjkChars = (markdown.match(/[\u4e00-\u9fa5]/g) ?? []).length
  const words = (markdown.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g) ?? []).length
  const chars = markdown.replace(/\s/g, '').length
  return {
    chars,
    cjkChars,
    words,
    lines: lines.length,
    headings: parseOutline(markdown).length,
  }
}

/** 行号 → 标题路径（面包屑） */
export function headingPathAtLine(outline: OutlineItem[], lineNo: number): string[] {
  const path: OutlineItem[] = []
  for (const item of outline) {
    if (item.line > lineNo) break
    // 维护层级栈：仅保留比当前项浅的祖先
    while (path.length > 0 && item.level <= outline[path.length - 1].level) {
      path.pop()
    }
    path.push(item)
  }
  return path.map((p) => p.text)
}
