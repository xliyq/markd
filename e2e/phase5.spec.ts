import { test, expect, Page } from '@playwright/test'

/**
 * Phase 5 验收 e2e：核心交互回归。
 * 只测真实浏览器里可靠的交互（功能细节由单测覆盖）。
 */

async function openApp(page: Page) {
  await page.goto('/')
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 15000 })
}

test('编辑器加载 + 表格插入 + 主题切换 + 设置面板', async ({ page }) => {
  await openApp(page)
  // 首次启动会弹欢迎面板 → 跳过（若存在）
  const welcomeSkip = page.locator('.n-modal button', { hasText: '跳过' })
  if (await welcomeSkip.count()) await welcomeSkip.first().click()
  await expect(page.locator('.n-modal')).toBeHidden({ timeout: 5000 }).catch(() => {})
  const editable = page.locator('.editor-root .milkdown [contenteditable="true"]').first()
  await expect(editable).toBeVisible({ timeout: 15000 })

  // 1) 编辑可用：输入文字
  await editable.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Delete')
  await page.keyboard.type('## 标题\n')
  await page.keyboard.type('段落内容\n')
  await expect(page.locator('.editor-root .milkdown h2').first()).toContainText('标题')

  // 2) 表格：slash 菜单插入
  // 先 Enter 换行到空段，再输入 / 触发 slash（避免拼接到"段落内容"后）
  await editable.click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/')
  await expect(page.locator('.milkdown-slash[data-show="true"]').first()).toBeVisible({ timeout: 5000 })
  await page.locator('.milkdown-slash .slash-item', { hasText: '表格' }).first().click()
  await expect(page.locator('.milkdown-table-block table.children').first()).toBeVisible({ timeout: 5000 })
  const thCount = await page.locator('.milkdown-table-block th').count()
  expect(thCount).toBeGreaterThan(0)

  // 3) 主题按钮存在（data-theme 有效）
  await expect(page.locator('.toolbar-btn[title="切换主题"]')).toBeVisible()
  const dataTheme = await page.locator('html').getAttribute('data-theme')
  expect(['light', 'dark']).toContain(dataTheme)

  // 4) 设置面板打开/关闭
  await page.locator('button[title="设置"]').click()
  const settingsModal = page.locator('.n-modal', { hasText: '设置' })
  await expect(settingsModal).toBeVisible({ timeout: 5000 })
  await expect(settingsModal).toContainText('主题')
  await expect(settingsModal).toContainText('插件')
  await settingsModal.locator('.n-base-close').first().click()
  await expect(settingsModal).toBeHidden()
})


/**
 * M1.12 首启引导 + 空库引导验收。
 * 首次启动（无 first-run.v1 setting）→ 欢迎面板；
 * 新建文档 → 面板消失 + 文档打开。
 */
test('首启欢迎引导（M1.12）', async ({ page }) => {
  // 清空 IndexedDB 模拟全新环境
  await page.goto('/')
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.() ?? []
    for (const db of dbs) if (db.name) indexedDB.deleteDatabase(db.name)
  })
  await page.reload()
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 15000 })

  // 1) 欢迎面板出现（Naive n-modal）
  await expect(page.locator('.n-modal')).toContainText('欢迎使用', { timeout: 15000 })
  console.log('WELCOME-OK')

  // 2) 新建文档 → 自绘对话框 → 面板消失 + 文档打开
  await page.locator('.n-modal button', { hasText: '新建文档' }).first().click()
  // 欢迎 modal 与 InputDialog 并存时以 n-input 为锚（两者都含「新建文档」文本）
  const createInput = page.locator('.n-modal .n-input input')
  await expect(createInput).toBeVisible({ timeout: 5000 })
  await createInput.fill('首启测试')
  await page.getByRole('button', { name: '创建' }).click()
  await expect(page.locator('.n-modal .n-input')).toBeHidden({ timeout: 5000 })
  await expect(page.locator('.n-modal')).toBeHidden({ timeout: 5000 })
  await expect(page.locator('.doc-title')).toHaveText('首启测试', { timeout: 5000 })
  console.log('WELCOME-CREATE-OK')

  // 3) 刷新（setting 已写）→ 不再显示欢迎面板
  await page.reload()
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.n-modal')).toBeHidden({ timeout: 5000 })
  // 文档树里有文档 → 无空库提示
  await expect(page.locator('[role="treeitem"]', { hasText: '首启测试' })).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.empty-hint')).toBeHidden({ timeout: 3000 })
  console.log('WELCOME-PERSIST-OK')
})
