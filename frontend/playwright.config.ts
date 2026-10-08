import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import { mkdtempSync } from "node:fs";

const backendDirectory = path.resolve(__dirname, "../backend");
const python = path.join(backendDirectory, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const frontendUrl = "http://127.0.0.1:3100";
const backendUrl = "http://127.0.0.1:8100";
const databasePath = path.join(mkdtempSync(path.join(os.tmpdir(), "scaler-signal-e2e-")), "test.sqlite3");
const gatewayKey = "phase-two-e2e-only-gateway-key-123456789";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR ?? path.join(os.tmpdir(), "scaler-signal-playwright"),
  use: {
    baseURL: frontendUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "chromium-mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
  ],
  webServer: [
    {
      command: `"${python}" -m tests.e2e_server`,
      cwd: backendDirectory,
      url: `${backendUrl}/v1/health/live`,
      timeout: 30_000,
      reuseExistingServer: false,
      env: { HOST: "127.0.0.1", PORT: "8100", FRONTEND_ORIGIN: frontendUrl, DATABASE_PATH: databasePath, INTERNAL_API_KEY: gatewayKey, AUTH_RATE_LIMIT: "1000" },
    },
    {
      command: "npm run dev -- --port 3100",
      url: frontendUrl,
      timeout: 120_000,
      reuseExistingServer: false,
      env: { BACKEND_BASE_URL: backendUrl, FRONTEND_ORIGIN: frontendUrl, INTERNAL_API_KEY: gatewayKey, NEXT_PUBLIC_WS_URL: "ws://127.0.0.1:8100/v1/ws", NEXT_TELEMETRY_DISABLED: "1" },
    },
  ],
});
