import { describe, it, expect } from 'vitest'
import { detectAndConvertTable, tableToMarkdown } from '../table-exchange/convert'

/**
 * M5.5 表格数据交换 —— 转换器单测：
 * Excel 复制（TSV）/ CSV（引号转义）/ 普通文本（不误转）/ 边界情况。
 */

describe('TSV（Excel 复制）', () => {
  it('多行多列 → GFM 表格', () => {
    const r = detectAndConvertTable('姓名\t年龄\n张三\t28\n李四\t32')
    expect(r).not.toBeNull()
    expect(r!.rows).toBe(3)
    expect(r!.cols).toBe(2)
    expect(r!.markdown).toBe([
      '| 姓名 | 年龄 |',
      '| --- | --- |',
      '| 张三 | 28 |',
      '| 李四 | 32 |',
    ].join('\n'))
  })

  it('单元格含 | 被转义', () => {
    const r = detectAndConvertTable('A\tB\nx|y\tz')
    expect(r).not.toBeNull()
    expect(r!.markdown).toContain('x\\|y')
  })
})

describe('CSV（引号转义）', () => {
  it('标准 CSV → GFM 表格', () => {
    const r = detectAndConvertTable('name,score\nalice,90\nbob,85')
    expect(r).not.toBeNull()
    expect(r!.rows).toBe(3)
    expect(r!.cols).toBe(2)
    expect(r!.markdown).toContain('| name | score |')
  })

  it('带引号单元格（含逗号）正确解析', () => {
    const r = detectAndConvertTable('a,b\n"x,y",z')
    expect(r).not.toBeNull()
    expect(r!.markdown).toContain('| x,y | z |')
  })
})

describe('普通文本（不误转）', () => {
  it('单行 → null（正常文本粘贴）', () => {
    expect(detectAndConvertTable('hello world')).toBeNull()
  })

  it('多行但单列 → null', () => {
    expect(detectAndConvertTable('第一行\n第二行')).toBeNull()
  })

  it('多行多列但列数不一致（非表格）→ null', () => {
    expect(detectAndConvertTable('a,b\nc')).toBeNull()
  })

  it('列数一致的 CSV 形多行文本 → 正常转表格（设计取舍）', () => {
    // 2 行 3 列一致 → 命中 CSV 规则转表格（这是设计：复制表格数据就该转）
    const r = detectAndConvertTable('今天,天气,好\n没事,出门,走走')
    expect(r).not.toBeNull()
    expect(r!.rows).toBe(2)
    expect(r!.cols).toBe(3)
  })

  it('多行文本列数不同（散文）→ null', () => {
    // 散文段落列数不一致 → 不误判为表格
    expect(detectAndConvertTable('今天天气不错\n我们出去走走，顺便买点东西')).toBeNull()
  })
})

describe('tableToMarkdown 工具', () => {
  it('二维数组 → 完整的 GFM 表格（表头+分隔+体）', () => {
    const md = tableToMarkdown([
      ['列A', '列B'],
      ['1', '2'],
    ])
    expect(md).toBe('| 列A | 列B |\n| --- | --- |\n| 1 | 2 |')
  })
})
