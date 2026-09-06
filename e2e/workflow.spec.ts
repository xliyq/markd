import { test, expect, Page } from '@playwright/test'

/**
 * Phase 1/2 出口 e2e：新建→输入→自动保存→重开加载 全流程
 *
 * 覆盖：应用壳启动、文档树新建（prompt 对话框）、编辑器输入、
 *      自动保存（600ms 防抖落库）、刷新重开后内容恢复。
 *
 * 注意：FileTree 用自绘 InputDialog（替代原生 prompt/confirm）。
 */

/** 通过自绘 InputDialog 新建文档（填输入框 + 点创建） */
async function createDocViaDialog(page: Page, name: string) {
  const dlg = page.locator('.n-modal', { hasText: '新建文档' })
  await dlg.locator('.n-input input').fill(name)
  await dlg.getByRole('button', { name: '确定' }).click()
  await expect(dlg).toBeHidden({ timeout: 5000 })
}

test.describe('文档全流程 e2e', () => {
  test('新建 → 输入 → 自动保存 → 重开加载', async ({ page }) => {
    // 1) 应用启动
    await page.goto('/')
    await expect(page.locator('.app-shell')).toBeVisible()
    await expect(page.locator('.statusbar')).toBeVisible()

    // 首次启动会弹欢迎面板 → 跳过（若存在）
    const welcomeSkip = page.locator('.n-modal button', { hasText: '跳过' })
    if (await welcomeSkip.count()) await welcomeSkip.first().click()
    await expect(page.locator('.n-modal')).toBeHidden({ timeout: 5000 }).catch(() => {})

    // 等待编辑器就绪（示例文档挂载）
    await expect(page.locator('.editor-root .milkdown').first()).toBeVisible({ timeout: 15000 })

    // 2) 新建文档（文档树工具栏「新建文档」→ 自绘对话框输入名称）
    await page.locator('.tree-toolbar button', { hasText: '新增' }).click()
    const createModal = page.locator('.n-modal', { hasText: '新增' })
    await expect(createModal).toBeVisible({ timeout: 5000 })
    await createModal.locator('.n-input input').fill('E2E 测试文档')
  await createModal.getByRole('button', { name: '创建' }).click()
  await expect(createModal).toBeHidden({ timeout: 5000 })

    // 树中出现新节点（等待刷新）
    const node = page.locator('[role="treeitem"]', { hasText: 'E2E 测试文档' })
    await expect(node).toBeVisible({ timeout: 10000 })

    // 3) 打开该文档（点击节点）
    await node.click()
    // 标题栏显示文档名
    await expect(page.locator('.doc-title')).toHaveText('E2E 测试文档', { timeout: 10000 })

    // 4) 编辑器输入内容
    const editable = page.locator('.editor-root .milkdown [contenteditable="true"]').first()
    await expect(editable).toBeVisible()
    await editable.click()
    await page.keyboard.type('# E2E 标题\n\n这是**自动保存**测试内容', { delay: 10 })

    // 5) 等待自动保存落库（防抖 600ms + IndexedDB 写入，给足余量）
    await page.waitForTimeout(2500)

    // 6) 重开：刷新页面（等价于关闭重开）
    await page.reload()
    await expect(page.locator('.app-shell')).toBeVisible()

    // 树中仍有该文档
    const node2 = page.locator('[role="treeitem"]', { hasText: 'E2E 测试文档' })
    await expect(node2).toBeVisible({ timeout: 15000 })

    // 7) 打开并验证内容恢复
    await node2.click()
    await expect(page.locator('.doc-title')).toHaveText('E2E 测试文档', { timeout: 10000 })
    // 内容渲染为标题（说明加载成功）
    await expect(page.locator('.editor-root h1', { hasText: 'E2E 标题' }).first()).toBeVisible({ timeout: 15000 })
  })
})
