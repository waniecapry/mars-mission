import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:4174";

export default defineConfig
({
    testDir: "./e2e",
    fullyParallel: true,
    reporter: [["list"], ["html", { open: "never" }]],
    use:
    {
        baseURL,
        trace: "retain-on-failure",
        screenshot: "only-on-failure"
    },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
    webServer:
    {
        command: "npm run dev -- --port 4174 --strictPort",
        url: baseURL,
        reuseExistingServer: false,
        env: { API_PROXY_TARGET: "http://127.0.0.1:1" }
    }
});