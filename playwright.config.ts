import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60000,
  use: { baseURL: 'http://localhost:4378' },
  webServer: {
    command: 'npm run build && npx vite preview --port 4378 --strictPort',
    port: 4378,
    reuseExistingServer: true,
    timeout: 60000
  }
});
