import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./playwright",
  timeout: 30000,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    locale: "es",
  },
  projects: [
    {
      name: "setup",
      testMatch: "**/auth.setup.js",
    },
    {
      name: "notification-responsive",
      testMatch: "**/notification-center-responsive.spec.js",
      dependencies: ["setup"],
      use: {
        storageState: "./playwright/.auth/user.json",
      },
    },
  ],
});
