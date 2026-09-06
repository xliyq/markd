// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 样式回归防护（2026-08-31 事故复盘）：
 * 「功能正常、样式裸奔」型 bug 的双保险——
 * 1. 主题 CSS 必须完整打包（大小基线 + 关键排版类）
 * 2. 表格 table-block 组件类名必须被覆盖（官方主题版本错位的兜底）
 */

const THEME_CSS_PATH = 'D:\\DevSpace\\research\\milkdown\\node_modules\\.pnpm\\@milkdown+theme-nord@7.22.1\\node_modules\\@milkdown\\theme-nord\\lib\\style.css'
const TABLE_CSS_PATH = 'D:\\DevSpace\\research\\milkdown\\packages\\plugins-editor\\src\\table\\style.css'

let themeCss = ''
let tableCss = ''

beforeAll(() => {
  themeCss = readFileSync(THEME_CSS_PATH, 'utf-8')
  tableCss = readFileSync(TABLE_CSS_PATH, 'utf-8')
})

describe('主题样式完整性（theme-nord）', () => {
  it('CSS 大小基线（≥8 kB，防止样式丢失回归）', () => {
    expect(themeCss.length).toBeGreaterThan(8000)
    console.log(`theme-nord style.css: ${(themeCss.length / 1024).toFixed(1)} kB`)
  })

  it('编辑器根类 + 排版基础类', () => {
    expect(themeCss).toContain('.milkdown-theme-nord')
    expect(themeCss).toContain('prose')
    expect(themeCss).toContain('.ProseMirror')
  })

  it('排版元素（标题/引用/代码/图片/表格）', () => {
    expect(themeCss).toContain('blockquote')
    expect(themeCss).toContain('code')
    expect(themeCss).toContain('pre')
    expect(themeCss).toContain('table')
    expect(themeCss).toContain('img')
  })
})

describe('表格 table-block 样式覆盖（主题缺失兜底）', () => {
  it('大小基线（≥1 kB）', () => {
    expect(tableCss.length).toBeGreaterThan(1000)
  })

  it('组件根类与容器（对齐 7.22 真实 DOM）', () => {
    expect(tableCss).toContain('.milkdown-table-block')
    expect(tableCss).toContain('.table-wrapper')
    expect(tableCss).toContain('table.children')
  })

  it('单元格/表头/选中态（官方后代选择器覆盖 table.children 内单元格）', () => {
    // 官方写法：.milkdown-table-block th/td（后代选择器，含 table.children 内）
    expect(tableCss).toContain('.milkdown-table-block th')
    expect(tableCss).toContain('.milkdown-table-block td')
    expect(tableCss).toContain('.selectedCell')
  })

  it('手柄 data-show 显隐控制（官方：opacity 过渡，不用 display:none）', () => {
    // 官方：.handle[data-show='false'] { opacity: 0 }（保持 DOM 可测量）
    expect(tableCss).toContain(".handle[data-show='false']")
    expect(tableCss).toContain('opacity: 0')
  })

  it('拖拽预览默认隐藏（官方：display:none）', () => {
    expect(tableCss).toContain('.drag-preview')
    expect(tableCss).toContain(".drag-preview[data-show='false']")
    expect(tableCss).toContain('display: none')
  })

  it('Crepe 主题变量定义（light + dark 双套）', () => {
    expect(tableCss).toContain('--crepe-color-surface')
    expect(tableCss).toContain('--crepe-color-primary')
    expect(tableCss).toContain('--crepe-color-selected')
    expect(tableCss).toContain("html[data-theme='dark'] .milkdown")
  })

  it('renderButton 官方默认值（table 插件源码）', () => {
    const tableTs = readFileSync(
      'D:\\DevSpace\\research\\milkdown\\packages\\plugins-editor\\src\\table\\index.ts',
      'utf-8'
    )
    // add_row/add_col 必须返回 '+'（官方 config.ts 默认）
    expect(tableTs).toContain("case 'add_row':")
    expect(tableTs).toContain("return '+'")
    // 拖拽手柄返回 '='（官方胶囊纹理）
    expect(tableTs).toContain("'col_drag_handle'")
  })
})
