import { test as setup } from '@playwright/test'
import fs from 'fs'

const authFile = 'e2e/.auth/user.json'

/**
 * Log in once via the real login page and persist the session so the specs
 * start authenticated. Credentials match the seeded admin user.
 */
setup('authenticate', async ({ page }) => {
  fs.mkdirSync('e2e/.auth', { recursive: true })

  await page.goto('/login')
  await page.fill('#email', 'admin@kontado.local')
  await page.fill('#password', 'password')
  await page.click('button[type=submit]')

  // Successful credentials login redirects to the dashboard.
  await page.waitForURL('**/dashboard', { timeout: 30_000 })

  await page.context().storageState({ path: authFile })
})
