import { test, expect, type Page } from "@playwright/test";

const origin = "http://127.0.0.1:3100";

async function login(page: Page, username: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Demo OTP", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Profile:/ })).toBeVisible();
}

test("register, wrong OTP recovery, persistent reload, logout and login", async ({ page, context }, testInfo) => {
  const username = testInfo.project.name.includes("mobile") ? "pw_mobile" : "pw_desktop";
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await expect(page.getByRole("button", { name: "Create demo account" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("signed-out.png"), fullPage: true });
  await page.getByLabel("Username", { exact: true }).fill(username.toUpperCase());
  await page.getByLabel("Display name", { exact: true }).fill("Browser Test Person");
  await page.getByRole("radio", { name: "Fern" }).check();
  await page.getByLabel("Demo OTP", { exact: true }).fill("000000");
  await page.getByRole("button", { name: "Create demo account" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Incorrect demo OTP" })).toBeVisible();
  await page.getByLabel("Demo OTP", { exact: true }).fill("123456");
  const registration = page.waitForResponse(response => new URL(response.url()).pathname === "/api/auth/register" && response.status() === 201);
  await page.getByRole("button", { name: "Create demo account" }).click();
  const response = await registration;
  const body = await response.json();
  expect(Object.keys(body).sort()).toEqual(["csrf_token", "expires_at", "user"]);
  expect(response.headers()["cache-control"]).toBe("no-store");
  await expect(page.getByRole("button", { name: "Profile: Browser Test Person" })).toBeVisible();
  await expect(page.getByRole("img", { name: "fern avatar" })).toBeVisible();
  const cookie = (await context.cookies()).find(item => item.name === "scaler_session");
  expect(Boolean(cookie?.httpOnly && cookie.sameSite === "Lax" && cookie.domain === "127.0.0.1" && cookie.path === "/" && cookie.expires > Date.now() / 1000)).toBe(true);
  expect(cookie?.secure).toBe(false); // loopback HTTP development exception
  expect(JSON.stringify(body).includes(cookie!.value)).toBe(false);
  expect(await page.evaluate(() => ({ cookies: document.cookie.includes("scaler_session"), local: localStorage.length, session: sessionStorage.length }))).toEqual({ cookies: false, local: 0, session: 0 });
  await page.reload();
  await expect(page.getByRole("button", { name: "Profile: Browser Test Person" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("signed-in.png"), fullPage: true });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page.getByRole("button", { name: "Create demo account" })).toBeVisible();
  expect((await context.cookies()).some(item => item.name === "scaler_session")).toBe(false);
  await login(page, username);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByText("@" + username, { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("seed login and forwarding enforce cookie identity, Origin and CSRF", async ({ page, context, request }) => {
  expect((await request.get("/api/auth/me", { headers: { Authorization: "Bearer " + "x".repeat(43) } })).status()).toBe(401);
  expect((await request.get("/api/auth/me", { headers: { Cookie: "scaler_session=malformed" } })).status()).toBe(401);
  const untrusted = await request.post("http://127.0.0.1:8100/v1/auth/challenges", { data: { username: "alice", purpose: "login" } });
  expect(untrusted.status()).toBe(403);
  expect((await request.post("/api/auth/challenges", { data: { username: "alice", purpose: "login" }, headers: { Origin: "http://evil.example" } })).status()).toBe(403);
  expect((await request.post("/api/auth/challenges", { data: { username: "alice", purpose: "login" } })).status()).toBe(403);
  await login(page, "alice");
  const me = await context.request.get("/api/auth/me?user_id=900002", { headers: { Authorization: "Bearer " + "x".repeat(43), "X-User-Id": "900002" } });
  expect(me.status()).toBe(200);
  expect((await me.json()).user.username).toBe("alice");
  expect((await context.request.post("/api/auth/logout", { data: {}, headers: { Origin: origin } })).status()).toBe(403);
  expect((await context.request.post("/api/auth/logout", { data: {}, headers: { Origin: "http://evil.example", "X-CSRF-Token": (await me.json()).csrf_token } })).status()).toBe(403);
  expect((await context.request.patch("/api/users/me", { data: { display_name: "Injected", avatar_key: "sky", user_id: 900002 }, headers: { Origin: origin, "X-CSRF-Token": (await me.json()).csrf_token } })).status()).toBe(422);
  await page.reload();
  await expect(page.getByRole("button", { name: "Profile: Alice Morgan" })).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page.getByRole("button", { name: "Create demo account" })).toBeVisible();
});

test("two independent browser sessions retain their own seeded identity", async ({ browser, page }) => {
  await login(page, "alice");
  const other = await browser.newContext({ baseURL: origin });
  try {
    const bobPage = await other.newPage();
    await login(bobPage, "bob");
    await expect(bobPage.getByRole("button", { name: "Profile: Bob Patel" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Profile: Alice Morgan" })).toBeVisible();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
    await bobPage.reload();
    await expect(bobPage.getByRole("button", { name: "Profile: Bob Patel" })).toBeVisible();
  } finally { await other.close(); }
});
