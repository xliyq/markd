import { test, expect } from '@playwright/test'

test('debug block handle click', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.milkdown h1')).toBeVisible({ timeout: 20000 })
  const skipBtn = page.locator('.n-modal button', { hasText: '跳过' })
  if (await skipBtn.count() > 0) {
    await skipBtn.first().click()
    await page.waitForTimeout(300)
  }

  const pm = page.locator('.milkdown .ProseMirror')
  await expect(pm).toBeVisible()
  await pm.click()
  await page.waitForTimeout(200)

  // 收集所有 console logs
  const logs: string[] = []
  page.on('console', msg => {
    logs.push(`[${msg.type()}] ${msg.text()}`)
  })

  // 检查句柄位置
  const handleInfo = await page.evaluate(() => {
    const handle = document.querySelector('.milkdown-block-handle') as HTMLElement
    if (!handle) return { error: 'no handle' }
    
    const rect = handle.getBoundingClientRect()
    const grip = handle.querySelector('.block-handle-grip') as HTMLElement
    const addBtn = handle.querySelector('.block-handle-add') as HTMLElement
    
    return {
      handleRect: rect,
      handleDisplay: getComputedStyle(handle).display,
      handleOpacity: getComputedStyle(handle).opacity,
      addBtnRect: addBtn ? addBtn.getBoundingClientRect() : null,
      addBtnDisplay: addBtn ? getComputedStyle(addBtn).display : 'n/a',
      addBtnPointerEvents: addBtn ? getComputedStyle(addBtn).pointerEvents : 'n/a',
      // 检查按钮的点击处理
      btnHasClickHandler: (() => {
        const clickEvent = new MouseEvent('click', { bubbles: true })
        let called = false
        const mockBtn = document.createElement('div')
        mockBtn.addEventListener('click', () => { called = true })
        mockBtn.dispatchEvent(clickEvent)
        return called
      })(),
    }
  })
  console.log('HANDLE_INFO:', JSON.stringify(handleInfo, null, 2))
  
  // 找出句柄关联的是哪个段落
  const paraInfo = await page.evaluate(() => {
    const handle = document.querySelector('.milkdown-block-handle') as HTMLElement
    if (!handle) return { error: 'no handle' }
    
    const handleRect = handle.getBoundingClientRect()
    const handleY = handleRect.top + handleRect.height / 2
    
    // 找最近的段落
    const paras = document.querySelectorAll('.milkdown .ProseMirror p')
    let closest: { tag: string; y: number; dist: number } | null = null
    for (const p of paras) {
      const rect = p.getBoundingClientRect()
      const dist = Math.abs((rect.top + rect.height / 2) - handleY)
      if (!closest || dist < closest.dist) {
        closest = { tag: p.textContent?.slice(0, 30) || '', y: rect.top + rect.height / 2, dist }
      }
    }
    return { closestPara: closest }
  })
  console.log('PARA_INFO:', JSON.stringify(paraInfo))
  
  // 尝试直接调用按钮的 click
  await page.evaluate(() => {
    const btn = document.querySelector('.block-handle-add') as HTMLElement
    if (!btn) return
    console.log('[EVAL] calling btn.click()')
    btn.click()
  })
  
  await page.waitForTimeout(600)
  
  console.log('ALL_LOGS:', JSON.stringify(logs))
  
  const afterParas = await pm.locator('p').count()
  console.log('AFTER_PARAS:', afterParas)
})
