const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/integration',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    viewport: { width: 1280, height: 900 }
  },
  webServer: {
    command: 'npx http-server public -a 127.0.0.1 -p 4173 -s',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});
