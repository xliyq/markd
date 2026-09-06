import { test, expect, Page } from '@playwright/test'

/**
 * 顶部编辑工具栏 e2e：按钮命令真实生效。
 */
async function openApp(page: Page) {
  await page.goto('/')
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 15000 })
}

test('工具栏命令执行（加粗/标题/列表/表格）', async ({ page }) => {
  await openApp(page)
  const welcomeSkip = page.locator('.n-modal button', { hasText: '跳过' })
  if (await welcomeSkip.count()) await welcomeSkip.first().click()
  await expect(page.locator('.milkdown h1').first()).toBeVisible({ timeout: 10000 })
  const toolbar = page.locator('.editor-toolbar')
  await expect(toolbar).toBeVisible()

  const editable = page.locator('.milkdown [contenteditable="true"]').first()

  // 先清空文档（Control+A + Delete），让后续输入位置完全确定
  await editable.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Delete')
  await page.waitForTimeout(200)

  // 1) 输入文本 → 加粗（需要选中文本）
  await page.keyboard.type('加粗测试', { delay: 10 })
  await page.keyboard.press('Home')
  await page.keyboard.press('Shift+End')
  await page.waitForTimeout(200)
  await toolbar.locator('button[title="加粗 (Ctrl+B)"]').click()
  await page.waitForTimeout(300)
  await expect(page.locator('.milkdown strong', { hasText: '加粗测试' })).toBeVisible({ timeout: 3000 })
  console.log('TOOLBAR-BOLD-OK')

  // 2) 标题 H2（光标在段内即可整段包裹，无需选中）
  await page.keyboard.press('End')      // 光标移到加粗文本末尾
  await page.keyboard.press('Enter')    // 新建段落
  await page.keyboard.type('二级标题', { delay: 10 })
  await page.waitForTimeout(150)
  await toolbar.locator('button[title="二级标题"]').click()
  await page.waitForTimeout(300)
  await expect(page.locator('.milkdown h2', { hasText: '二级标题' }).first()).toBeVisible({ timeout: 3000 })
  console.log('TOOLBAR-H2-OK')

  // 3) 无序列表（同 H2：光标入段）
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('列表项', { delay: 10 })
  await page.waitForTimeout(150)
  await toolbar.locator('button[title="无序列表"]').click()
  await page.waitForTimeout(300)
  await expect(page.locator('.milkdown li', { hasText: '列表项' })).toBeVisible({ timeout: 3000 })
  console.log('TOOLBAR-LIST-OK')

  // 4) 表格
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await toolbar.locator('button[title="插入表格"]').click()
  await page.waitForTimeout(300)
  await expect(page.locator('.milkdown-table-block').first()).toBeVisible({ timeout: 3000 })
  console.log('TOOLBAR-TABLE-OK')

  // 5) 链接弹窗（自绘 InputDialog，非原生 prompt）
  await editable.click()
  await page.keyboard.press('Control+A')
  await page.waitForTimeout(200)
  await toolbar.locator('button[title="插入链接"]').click()
  const linkModal = page.locator('.n-modal').last()
  await expect(linkModal).toBeVisible({ timeout: 3000 })
  await linkModal.locator('.n-input input').nth(1).fill('https://example.com')
  await linkModal.getByRole('button', { name: '确定' }).click()
  await expect(linkModal).toBeHidden({ timeout: 3000 })
  console.log('TOOLBAR-LINK-DIALOG-OK')
})
