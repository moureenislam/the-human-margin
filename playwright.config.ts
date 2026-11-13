import { defineConfig } from '@playwright/test';

// Runs against the built single-file game (npm run build first), opened from disk like a judge would.
// Uses the Edge or Chrome already installed: set PW_CHANNEL=chrome to switch.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  fullyParallel: true,
  reporter: 'list',
  use: {
    channel: process.env.PW_CHANNEL ?? 'msedge',
    viewport: { width: 1280, height: 720 },
  },
});
