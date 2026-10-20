import { defineConfig, devices } from '@playwright/test';

/*
 * Run from this folder:
 *   npm install
 *   npx playwright install chromium
 *   npm test
 *
 * The config starts a local static server for the app automatically.
 * Requires Python 3 on Windows (python -m http.server) or set your own command.
 *
 * The default projects use Chromium sized like an iPhone so the tests run with
 * a single browser download. To test the real Safari engine as well:
 *   npx playwright install webkit
 *   npx playwright test --project=iphone-11-safari
 */
export default defineConfig({
  testDir: './tests',
  timeout: 120000,
  expect: { timeout: 8000 },
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:8080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'iphone-11',
      use: {
        ...devices['iPhone 11'],
        defaultBrowserType: 'chromium',
        browserName: 'chromium'
      }
    },
    {
      name: 'iphone-se',
      use: {
        ...devices['iPhone SE'],
        defaultBrowserType: 'chromium',
        browserName: 'chromium'
      }
    },
    {
      name: 'iphone-11-safari',
      use: { ...devices['iPhone 11'] }
    }
  ],
  webServer: {
    command: 'python -m http.server 8080',
    url: 'http://127.0.0.1:8080',
    reuseExistingServer: true,
    cwd: '../..'
  }
});
