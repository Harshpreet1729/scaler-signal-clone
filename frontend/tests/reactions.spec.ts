import { test, expect, type Page, type WebSocketRoute } from "@playwright/test";

const origin = "http://127.0.0.1:3100";
async function login(page: Page, username: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Demo OTP").fill("123456");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByTestId("connection-status")).toHaveAttribute("data-state", "connected");
}
async function api(page: Page, path: string, body?: unknown, method = body ? "POST" : "GET") {
  return page.evaluate(async ({ path, body, method }) => {
    const me = await (await fetch("/api/auth/me")).json();
    const response = await fetch(path, { method, headers: { "Content-Type": "application/json", "X-CSRF-Token": me.csrf_token }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }, { path, body, method });
}
const row = (page: Page, body: string) => page.locator(".message-row").filter({ hasText: body });
const chip = (page: Page, body: string, emoji: string) => row(page, body).locator(".reaction-chip").filter({ hasText: emoji });

test("direct emoji picker, live counts, own toggles, stale event and refresh", async ({ page, browser }, info) => {
  const other = await browser.newContext({ baseURL: origin, viewport: info.project.use.viewport });
  const bob = await other.newPage();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  bob.on("pageerror", error => errors.push(error.message));
  let socket: WebSocketRoute | undefined;
  let oldEvent: string | undefined;
  try {
    await page.routeWebSocket("ws://127.0.0.1:8100/v1/ws", route => {
      socket = route;
      const server = route.connectToServer();
      server.onMessage(message => {
        const event = JSON.parse(String(message));
        if (event.type === "reaction.updated" && !oldEvent) oldEvent = String(message);
        route.send(message);
      });
    });
    await login(page, "alice"); await login(bob, "bob");
    await expect(page).toHaveTitle(/Signal/);
    await page.getByRole("button", { name: /Bob Patel/ }).first().click();
    await bob.getByRole("button", { name: /Alice Morgan/ }).first().click();
    const body = "Reaction demo " + crypto.randomUUID().slice(0, 8);
    await page.getByLabel("Message draft").fill(body);
    await page.getByRole("button", { name: "Send message", exact: true }).click();
    await expect(row(bob, body)).toBeVisible();
    await row(page, body).hover();
    await row(page, body).getByRole("button", { name: "React to message" }).click();
    const picker = row(page, body).getByRole("group", { name: "Choose a reaction" });
    await expect(picker.getByRole("button")).toHaveCount(6);
    await expect(picker.getByRole("button", { name: "Thumbs up" })).toBeFocused();
    const rect = await picker.boundingBox();
    expect(rect!.x).toBeGreaterThanOrEqual(0);
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(info.project.use.viewport!.width);
    await page.screenshot({ path: info.outputPath("reaction-picker.png") });
    await picker.press("Escape");
    await expect(picker).toHaveCount(0);
    await expect(row(page, body).getByRole("button", { name: "React to message" })).toBeFocused();
    await row(page, body).getByRole("button", { name: "React to message" }).click();
    await page.getByLabel("Message draft").click();
    await expect(picker).toHaveCount(0);
    await row(page, body).getByRole("button", { name: "React to message" }).click();
    await picker.getByRole("button", { name: "Thumbs up" }).click();
    await expect(chip(page, body, "👍")).toHaveAttribute("aria-pressed", "true");
    await expect(chip(bob, body, "👍")).toHaveAttribute("aria-pressed", "false");
    await chip(bob, body, "👍").click();
    await expect(chip(page, body, "👍")).toHaveText("👍2");
    await chip(page, body, "👍").click();
    await expect(chip(page, body, "👍")).toHaveText("👍1");
    await expect(chip(page, body, "👍")).toHaveAttribute("aria-pressed", "false");
    // Replay an actual older server event after the newer removal; revision wins.
    expect(oldEvent).toBeTruthy(); socket!.send(oldEvent!);
    await expect(chip(page, body, "👍")).toHaveAttribute("aria-pressed", "false");
    await row(page, body).getByRole("button", { name: "React to message" }).click();
    await picker.getByRole("button", { name: "Heart" }).click();
    await expect(chip(bob, body, "❤️")).toHaveText("❤️1");
    await expect(row(page, body).getByRole("button", { name: "React to message" })).toBeFocused();
    await page.screenshot({ path: info.outputPath("direct-reactions.png") });
    const messageId = Number(await row(page, body).getAttribute("data-message-id"));
    const path = "/api/conversations/900001/reactions";
    const forbidden = await page.request.post(path, { headers: { Origin: origin }, data: { message_id: messageId, emoji: "😢", active: true } });
    expect(forbidden.status()).toBe(403);
    const evil = await page.request.post(path, { headers: { Origin: "https://evil.example" }, data: { message_id: messageId, emoji: "😢", active: true } });
    expect(evil.status()).toBe(403);
    const unchanged = await api(page, path, { message_id: messageId, emoji: "❤️", active: true });
    expect(unchanged.data.changed).toBe(false);
    await page.reload();
    await page.getByRole("button", { name: /Bob Patel/ }).first().click();
    await expect(chip(page, body, "❤️")).toHaveAttribute("aria-pressed", "true");
    await expect(chip(page, body, "👍")).toHaveAttribute("aria-pressed", "false");
    await chip(bob, body, "👍").click();
    await expect(chip(page, body, "👍")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally { await other.close(); }
});

test("group reactions recover missed changes then deny a removed member", async ({ page, browser }, info) => {
  const other = await browser.newContext({ baseURL: origin, viewport: info.project.use.viewport });
  const bob = await other.newPage();
  const connection: { first?: WebSocketRoute; allow: boolean; attempts: number } = { allow: false, attempts: 0 };
  const bobReactionFrames: unknown[] = [];
  let groupId: number | undefined;
  try {
    await page.routeWebSocket("ws://127.0.0.1:8100/v1/ws", route => {
      connection.attempts++;
      if (connection.attempts === 1) connection.first = route;
      if (connection.attempts === 1 || connection.allow) route.connectToServer();
      else void route.close({ code: 1012 });
    });
    await bob.routeWebSocket("ws://127.0.0.1:8100/v1/ws", route => {
      const server = route.connectToServer();
      server.onMessage(message => {
        if (JSON.parse(String(message)).type === "reaction.updated") bobReactionFrames.push(message);
        route.send(message);
      });
    });
    await login(page, "alice"); await login(bob, "bob");
    const name = "Reactions " + crypto.randomUUID().slice(0, 8);
    const created = await api(page, "/api/conversations/groups", { name, user_ids: [900002, 900003] });
    expect(created.status).toBe(201);
    const id = created.data.conversation.id;
    groupId = id;
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await bob.getByRole("button", { name: new RegExp(name) }).click();
    const body = "Group reactions " + crypto.randomUUID().slice(0, 8);
    await page.getByLabel("Message draft").fill(body);
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(row(bob, body)).toBeVisible();
    const messageId = Number(await row(bob, body).getAttribute("data-message-id"));
    await row(bob, body).hover();
    await row(bob, body).getByRole("button", { name: "React to message" }).click();
    await row(bob, body).getByRole("button", { name: "Laugh", exact: true }).click();
    await expect(chip(page, body, "😂")).toHaveText("😂1");
    await connection.first!.close({ code: 1012 });
    await expect(page.getByTestId("connection-status")).toHaveAttribute("data-state", "reconnecting");
    const path = `/api/conversations/${id}/reactions`;
    expect((await api(bob, path, { message_id: messageId, emoji: "😂", active: false })).status).toBe(200);
    expect((await api(bob, path, { message_id: messageId, emoji: "🙏", active: true })).status).toBe(200);
    connection.allow = true;
    await expect(page.getByTestId("connection-status")).toHaveAttribute("data-state", "connected", { timeout: 20000 });
    await expect(chip(page, body, "😂")).toHaveCount(0);
    await expect(chip(page, body, "🙏")).toHaveText("🙏1");
    await row(page, body).hover();
    await row(page, body).getByRole("button", { name: "React to message" }).click();
    await row(page, body).getByRole("button", { name: "Surprised", exact: true }).click();
    await expect(chip(bob, body, "😮")).toHaveText("😮1");
    await page.screenshot({ path: info.outputPath("group-reactions.png") });
    expect((await api(page, `/api/conversations/${id}/members/900002`, {}, "DELETE")).status).toBe(200);
    await expect(bob.getByRole("button", { name: new RegExp(name) })).toHaveCount(0);
    const count = bobReactionFrames.length;
    expect((await api(bob, path, { message_id: messageId, emoji: "❤️", active: true })).status).toBe(404);
    expect((await api(page, path, { message_id: messageId, emoji: "😢", active: true })).status).toBe(200);
    await expect(chip(page, body, "😢")).toHaveText("😢1");
    expect(bobReactionFrames).toHaveLength(count);
    expect((await api(bob, `/api/conversations/${id}/messages`)).status).toBe(404);
    await page.reload();
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await expect(chip(page, body, "🙏")).toHaveText("🙏1"); // Historical reaction retained.
    await expect(chip(page, body, "😢")).toHaveAttribute("aria-pressed", "true");
    if (info.project.name.includes("mobile")) {
      await page.setViewportSize({ width: 390, height: 600 });
      await row(page, body).getByRole("button", { name: "React to message" }).click();
      await expect(row(page, body).getByRole("button", { name: "Thanks", exact: true })).toBeInViewport();
      await expect(page.getByLabel("Message draft")).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath("group-reactions-small-height.png") });
    }
  } finally {
    // The suite shares one temporary DB across desktop/mobile projects. Do not
    // leave this extra Carol group in later tests' seeded-contact search scope.
    try { if (groupId) expect((await api(page, `/api/conversations/${groupId}/members/900003`, {}, "DELETE")).status).toBe(200); }
    finally { await other.close(); }
  }
});
