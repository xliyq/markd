import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright e2e 配置：
 * - webServer 自动启动 vp dev（本地优先应用必须走真实服务器）
 * - 单 worker（IndexedDB 测试需串行避免数据干扰）
 */
export default defineConfig({
  testDir: './e2e',
  // 全流程测试串行（IndexedDB 本地存储，并行会互相污染）
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'vp dev apps/editor',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
