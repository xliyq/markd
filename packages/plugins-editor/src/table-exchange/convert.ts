/**
 * 表格数据交换（M5.5）
 *
 * 纯函数：把 Excel/CSV/文本表格粘贴数据转换成 Markdown 表格语法。
 * - Excel 复制 → text/plain 为 TSV（\t 分隔）
 * - CSV 复制 → 逗号分隔（带引号转义）
 * - 仅当「≥2 行且 ≥2 列」判定为表格数据，否则返回 null（走正常文本粘贴）
 */
export interface TableDetectResult {
  /** 转换出的 Markdown 表格语法（含表头分隔行） */
  markdown: string
  rows: number
  cols: number
}

/** 拆行（兼容 \r\n / \n） */
function splitLines(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trimEnd())
}

/** 判断行是否为 TSV 多列 */
function isTsvLine(line: string): boolean {
  return line.includes('\t')
}

/** CSV 行解析（支持引号转义）：'a,"b,c",d' → ['a', 'b,c', 'd'] */
function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      cells.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current)
  return cells
}

/** 判断整块文本是否 CSV 表格形数据 */
function looksLikeCsv(lines: string[]): boolean {
  if (lines.length < 2) return false
  const colCounts = lines.map((l) => parseCsvLine(l).length)
  return colCounts.every((n) => n === colCounts[0]) && colCounts[0] >= 2
}

/** 转义 Markdown 表格单元格内容（| 和换行） */
function escapeCell(cell: string): string {
  return cell.replace(/\|/g, '\\|').replace(/\n/g, '<br>').trim()
}

/**
 * 识别并转换表格粘贴数据。
 * @returns 表格 Markdown；非表格数据返回 null
 */
export function detectAndConvertTable(text: string): TableDetectResult | null {
  if (!text || text.length === 0) return null
  const lines = splitLines(text).filter((l) => l.length > 0)
  if (lines.length < 2) return null

  // TSV 优先（Excel 复制）
  if (lines.every(isTsvLine)) {
    const rows = lines.map((l) => l.split('\t').map(escapeCell))
    const cols = rows[0].length
    if (cols < 2) return null
    return { markdown: tableToMarkdown(rows), rows: rows.length, cols }
  }

  // CSV（引号转义 + 列数一致）
  if (looksLikeCsv(lines)) {
    const rows = lines.map((l) => parseCsvLine(l).map(escapeCell))
    return { markdown: tableToMarkdown(rows), rows: rows.length, cols: rows[0].length }
  }

  return null
}

/** 二维数组 → GFM 表格语法（首行表头 + 分隔行） */
export function tableToMarkdown(rows: string[][]): string {
  const header = rows[0]
  const separator = header.map(() => '---')
  const body = rows.slice(1)
  const rowToLine = (cells: string[]) => `| ${cells.join(' | ')} |`
  return [rowToLine(header), rowToLine(separator), ...body.map(rowToLine)].join('\n')
}
