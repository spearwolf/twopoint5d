import {defineConfig, devices} from '@playwright/test';

import {fileURLToPath} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __topdir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const browsersFile = path.join(__topdir, 'playwright.browsers');

const allowedBrowsers: string[] = [];

if (fs.existsSync(browsersFile)) {
  const configuredBrowsers: string[] = fs.readFileSync(browsersFile, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  allowedBrowsers.push(
    ...Array.from(new Set(configuredBrowsers))
  );
}

function filterProjectsByBrowsers<T extends {name: string}>(projects: T[]): T[] {
  return projects.filter((project) => {
    if (allowedBrowsers.length === 0) {
      return true;
    }
    return allowedBrowsers.includes(project.name);
  });
}

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env['CI'],
  /* Retry on CI only */
  retries: process.env['CI'] ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env['CI'] ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  // reporter: 'html',
  // reporter: [['html', {open: 'never'}]],
  reporter: 'line',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:4173',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: filterProjectsByBrowsers([
    {
      name: 'firefox',
      use: {...devices['Desktop Firefox'], headless: true},
    },

    ...(process.env['CI']
      ? []
      : [
          {
            name: 'chrome',
            use: {
              ...devices['Desktop Chrome'],
              headless: true,
            },
          },
          {
            name: 'webkit',
            use: {...devices['Desktop Safari'], headless: true},
          },
        ]),
  ]),

  /* Test against mobile viewports. */
  // {
  //   name: 'Mobile Chrome',
  //   use: { ...devices['Pixel 5'] },
  // },
  // {
  //   name: 'Mobile Safari',
  //   use: { ...devices['iPhone 12'] },
  // },

  /* Test against branded browsers. */
  // {
  //   name: 'Microsoft Edge',
  //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
  // },
  // {
  //   name: 'Google Chrome',
  //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
  // },
  // ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'pnpm run preview', //  'pnpm run build:n:serve',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env['CI'],
  },
});
