import { test, expect, Page } from '@playwright/test'

async function openApp(page: Page) {
  await page.goto('/')
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 15000 })
  // 首次启动欢迎面板（Naive n-modal）→ 跳过（若存在；非首启时 n-modal 可能已无）
  await page.waitForTimeout(400)
  const skip = page.locator('.n-modal button', { hasText: '跳过' })
  if (await skip.count()) await skip.first().click()
  await expect(page.locator('.n-modal')).toBeHidden({ timeout: 5000 }).catch(() => {})
}

test('a11y 标注验证 + 键盘导航 v4（适配 Naive UI 应用壳）', async ({ page }) => {
  await openApp(page)
  const editable = page.locator('.milkdown [contenteditable="true"]').first()
  await expect(editable).toBeVisible({ timeout: 15000 })

  // 1) 应用壳 ARIA
  await expect(page.locator('main[role="main"][aria-label="编辑区"]')).toBeVisible()
  await expect(page.locator('aside[role="complementary"][aria-label="侧边栏"]')).toBeVisible()
  await expect(page.locator('footer[role="status"]')).toBeVisible()
  console.log('SHELL-ARIA: OK')

  // 2) 设置面板：Naive n-modal（role=dialog）+ 主题 radiogroup
  await page.locator('button[title="设置"]').click()
  const settingsModal = page.locator('.n-modal', { hasText: '设置' })
  await expect(settingsModal).toBeVisible({ timeout: 5000 })
  const radioCount = await settingsModal.locator('.n-radio-button').count()
  console.log('SETTINGS-RADIO: ' + radioCount)
  expect(radioCount).toBeGreaterThanOrEqual(3)
  // 关闭：naive modal 自带的关闭按钮
  await settingsModal.locator('.n-base-close').first().click()
  await expect(settingsModal).toBeHidden({ timeout: 5000 })

  // 3) 新建文档（Naive n-modal + n-input）→ 树节点出现（role=tree + treeitem）
  await page.locator('.tree-toolbar button', { hasText: '新增' }).click()
  const createModal = page.locator('.n-modal', { hasText: '新增' })
  await expect(createModal).toBeVisible({ timeout: 5000 })
  await createModal.locator('.n-input input').fill('a11y 测试文档')
  await createModal.getByRole('button', { name: '创建' }).click()
  await expect(createModal).toBeHidden({ timeout: 5000 })
  const tree = page.locator('[role="tree"]')
  await expect(tree).toBeVisible({ timeout: 5000 })
  const treeitems = tree.locator('[role="treeitem"]')
  const n = await treeitems.count()
  console.log('TREE-ITEMS: ' + n)
  expect(n).toBeGreaterThan(0)

  // 5) 键盘导航：聚焦第一个 treeitem → Enter 打开文档
  await treeitems.first().focus()
  const focusedRole = await page.evaluate(() => document.activeElement?.getAttribute('role'))
  console.log('FOCUSED: ' + focusedRole)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)
  const docTitle = await page.locator('.doc-title').textContent()
  console.log('AFTER-ENTER-DOCTITLE: ' + docTitle)
})
