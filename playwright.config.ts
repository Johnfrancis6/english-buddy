import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  // CI runners have 2 cores and no GPU: several software-rendered 3D pages at
  // once starve each other, so CI runs the tests one at a time.
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: 'http://localhost:4173/english-buddy/',
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--autoplay-policy=no-user-gesture-required',
      ],
    },
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173/english-buddy/',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
