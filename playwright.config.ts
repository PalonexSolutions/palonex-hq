import { defineConfig, devices } from "@playwright/test";

const url = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: url,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: { command: "npm run start -- --hostname 127.0.0.1 --port 3100", url },
});
