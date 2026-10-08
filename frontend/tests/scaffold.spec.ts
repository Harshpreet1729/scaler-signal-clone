import { test, expect } from "@playwright/test";

test("signed-out page hides chats and health link reaches real FastAPI", async ({ page, request }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/");
  await expect(page).toHaveTitle("Signal | Assignment preview");
  await expect(page.getByRole("heading", { level: 1, name: "Signal" })).toBeVisible();
  await expect(page.getByRole("main", { name: "Messenger preview" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create demo account" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("scaffold.png"), fullPage: true });

  const direct = await request.get("http://127.0.0.1:8100/v1/health/live");
  expect(direct.status()).toBe(200);
  const expected = { status: "ok", service: "scaler-signal-api" };
  expect(await direct.json()).toEqual(expected);

  const forwardedResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/health/live");
  await page.getByRole("link", { name: "Check backend health" }).click();
  const forwarded = await forwardedResponse;
  expect(forwarded.status()).toBe(200);
  expect(await forwarded.json()).toEqual(expected);
  expect(forwarded.headers()["cache-control"]).toBe("no-store");
  await expect(page).toHaveURL(/\/api\/health\/live$/);
  await expect(page.locator("body")).toContainText("scaler-signal-api");
  expect(errors).toEqual([]);
});

test("health forwarding is a fixed GET route, not a generic proxy", async ({ request }) => {
  expect((await request.post("/api/health/live")).status()).toBe(405);
  expect((await request.get("/api/not-allowlisted")).status()).toBe(404);
});
