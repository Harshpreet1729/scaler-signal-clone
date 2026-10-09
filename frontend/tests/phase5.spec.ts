import { test, expect, type Page, type WebSocketRoute } from "@playwright/test";

const origin = "http://127.0.0.1:3100";
async function login(page: Page, username: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Demo OTP").fill("123456");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Messages · connected")).toBeVisible();
}
async function api(page: Page, path: string, method = "GET", body?: unknown) {
  return page.evaluate(async ({ path, method, body }) => {
    const me = await (await fetch("/api/auth/me")).json();
    const response = await fetch(path, { method, headers: { "Content-Type": "application/json", "X-CSRF-Token": me.csrf_token }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }, { path, method, body });
}
async function send(page: Page, text: string) {
  await page.getByLabel("Message draft").fill(text);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
}
const history = (page: Page) => page.getByRole("region", { name: "Message history" });

test("reconnect repairs multiple history pages and an older read receipt", async ({ browser, page }, info) => {
  const bobContext = await browser.newContext({ baseURL: origin, viewport: info.project.use.viewport });
  const bob = await bobContext.newPage();
  const connection: { first?: WebSocketRoute; reconnect: boolean; attempts: number } = { reconnect: false, attempts: 0 };
  try {
    await page.routeWebSocket("ws://127.0.0.1:8100/v1/ws", route => {
      connection.attempts++;
      if (connection.attempts === 1) connection.first = route;
      if (connection.attempts === 1 || connection.reconnect) route.connectToServer();
      else void route.close({ code: 1012 });
    });
    await login(page, "alice"); await login(bob, "bob");
    const name = "Recovery " + crypto.randomUUID().slice(0, 8);
    const result = await api(page, "/api/conversations/groups", "POST", { name, user_ids: [900002] });
    expect(result.status).toBe(201);
    const id = result.data.conversation.id;
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await send(page, "Older receipt anchor");
    await expect(history(page).locator(".message-bubble").filter({ hasText: "Older receipt anchor" }).getByLabel("Status: delivered", { exact: true })).toBeVisible();
    await connection.first!.close({ code: 1012 });
    await expect(page.locator(".preview-caption")).toHaveText("Messages · reconnecting");
    await bob.getByRole("button", { name: new RegExp(name) }).click();
    await expect(history(bob).getByText("Older receipt anchor", { exact: true })).toBeVisible();
    for (let index = 0; index < 55; index++) {
      expect((await api(bob, `/api/conversations/${id}/messages`, "POST", { body: `Catch up ${index}`, client_message_id: crypto.randomUUID() })).status).toBe(201);
    }
    connection.reconnect = true;
    await expect(page.locator(".preview-caption")).toHaveText("Messages · connected", { timeout: 20000 });
    await expect(history(page).locator(".message-bubble")).toHaveCount(56);
    await expect(history(page).locator(".message-bubble").filter({ hasText: "Older receipt anchor" }).getByLabel("Status: read", { exact: true })).toHaveCount(1);
    await bob.reload();
    await bob.getByRole("button", { name: new RegExp(name) }).click();
    await expect(history(bob).locator(".message-bubble")).toHaveCount(50);
    await bob.getByRole("button", { name: "Load older messages" }).click();
    await expect(history(bob).locator(".message-bubble")).toHaveCount(56);
    await expect(history(bob).getByText("Older receipt anchor", { exact: true })).toBeInViewport();
  } finally { await bobContext.close(); }
});

test("real typing clears and duplicated live events create only one incoming toast", async ({ browser, page }, info) => {
  const bobContext = await browser.newContext({ baseURL: origin, viewport: info.project.use.viewport });
  const bob = await bobContext.newPage();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.routeWebSocket("ws://127.0.0.1:8100/v1/ws", route => {
      const server = route.connectToServer();
      server.onMessage(message => {
        route.send(message);
        const frame = JSON.parse(String(message));
        if (frame.type === "message.created") route.send(message); // Replay real data, never fabricate a reply.
      });
    });
    await login(page, "alice"); await login(bob, "bob");
    await expect(page).toHaveTitle(/Signal/);
    await page.getByRole("button", { name: /Bob Patel/ }).first().click();
    await bob.getByRole("button", { name: /Alice Morgan/ }).first().click();
    await bob.getByLabel("Message draft").fill("A draft");
    await expect(page.getByText("Bob is typing…", { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath("phase5-typing.png") });
    await bob.getByLabel("Message draft").fill("");
    await expect(page.getByText("Bob is typing…", { exact: true })).toHaveCount(0);
    await bob.getByLabel("Message draft").fill("Will expire");
    await expect(page.getByText("Bob is typing…", { exact: true })).toBeVisible();
    await expect(page.getByText("Bob is typing…", { exact: true })).toHaveCount(0, { timeout: 7000 });
    const back = page.getByRole("button", { name: "Back to conversations" });
    if (await back.isVisible()) await back.click();
    else await page.getByRole("button", { name: "Chats", exact: true }).click();
    const text = "Incoming " + crypto.randomUUID().slice(0, 8);
    await send(bob, text);
    await expect(page.locator(".toast")).toHaveCount(1);
    await expect(page.locator(".toast")).toContainText(text);
    await page.getByRole("button", { name: /Bob Patel/ }).first().click();
    await expect(history(page).getByText(text, { exact: true })).toHaveCount(1);
    await page.getByRole("button", { name: "Dismiss notification" }).click();
    await page.reload();
    await page.getByRole("button", { name: /Bob Patel/ }).first().click();
    await expect(history(page).getByText(text, { exact: true })).toHaveCount(1);
    await expect(page.locator(".toast")).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally { await bobContext.close(); }
});

test("offline sent, background delivered, visible read and durable unread", async ({ browser, page }, info) => {
  const bobContext = await browser.newContext({ baseURL: origin, viewport: info.project.use.viewport });
  const bob = await bobContext.newPage();
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  let readRequested = false;
  try {
    await login(page, "alice");
    await page.getByRole("button", { name: /Bob Patel/ }).first().click();
    const offline = "Offline " + crypto.randomUUID().slice(0, 8);
    await send(page, offline);
    const offlineBubble = history(page).locator(".message-bubble").filter({ hasText: offline });
    await expect(offlineBubble.getByLabel("Status: sent", { exact: true })).toBeVisible();
    await login(bob, "bob"); // No conversation selected; a live receipt is delivery, not reading.
    const live = "Background " + crypto.randomUUID().slice(0, 8);
    await send(page, live);
    const bubble = history(page).locator(".message-bubble").filter({ hasText: live });
    await expect(bubble.getByLabel("Status: delivered", { exact: true })).toBeVisible();
    await expect(bob.getByRole("button", { name: /Alice Morgan/ }).first().locator(".unread-badge")).toBeVisible();
    await page.screenshot({ path: info.outputPath("phase5-delivered.png") });
    await bob.route("**/api/conversations/900001/read", async route => { readRequested = true; await gate; await route.continue(); });
    await bob.getByRole("button", { name: /Alice Morgan/ }).first().click();
    await expect(history(bob).getByText(live, { exact: true })).toBeVisible();
    await expect.poll(() => readRequested).toBe(true);
    expect((await api(bob, "/api/conversations/900001")).data.conversation.unread_count).toBeGreaterThanOrEqual(2);
    await expect(bubble.getByLabel("Status: delivered", { exact: true })).toBeVisible();
    release();
    await expect(bubble.getByLabel("Status: read", { exact: true })).toBeVisible();
    await expect(offlineBubble.getByLabel("Status: read", { exact: true })).toBeVisible();
    await expect.poll(async () => (await api(bob, "/api/conversations/900001")).data.conversation.unread_count).toBe(0);
    await page.screenshot({ path: info.outputPath("phase5-read.png") });
    await page.reload();
    await page.getByRole("button", { name: /Bob Patel/ }).first().click();
    await expect(history(page).locator(".message-bubble").filter({ hasText: live }).getByLabel("Status: read", { exact: true })).toBeVisible();
  } finally { release(); await bobContext.close(); }
});

test("group creation, three live members, reload and admin revocation", async ({ browser, page }, info) => {
  const bobContext = await browser.newContext({ baseURL: origin, viewport: info.project.use.viewport });
  const carolContext = await browser.newContext({ baseURL: origin, viewport: info.project.use.viewport });
  const bob = await bobContext.newPage(), carol = await carolContext.newPage();
  const name = "Weekend test " + crypto.randomUUID().slice(0, 8);
  try {
    await login(page, "alice"); await login(bob, "bob"); await login(carol, "carol");
    await page.getByRole("button", { name: "New chat", exact: true }).click();
    await page.getByRole("button", { name: "New group", exact: true }).click();
    await page.getByLabel("Group name", { exact: true }).fill(name);
    await page.getByRole("checkbox", { name: /Bob Patel/ }).check();
    await page.getByRole("checkbox", { name: /Carol Chen/ }).check();
    await page.getByRole("button", { name: "Create group" }).click();
    await expect(page.getByRole("region", { name: name + " conversation" })).toBeVisible();
    for (const peer of [bob, carol]) await peer.getByRole("button", { name: new RegExp(name) }).click();
    for (const [sender, text] of [[page, "Alice group hello"], [bob, "Bob group reply"], [carol, "Carol group reply"]] as const) {
      await send(sender, text);
      for (const peer of [page, bob, carol]) await expect(history(peer).getByText(text, { exact: true })).toHaveCount(1);
    }
    await page.reload();
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await expect(history(page).getByText("Carol group reply", { exact: true })).toHaveCount(1);
    const list = await api(page, "/api/conversations");
    const group = list.data.conversations.find((item: { name: string }) => item.name === name);
    expect((await api(bob, `/api/conversations/${group.id}/members/900003`, "DELETE", {})).status).toBe(403);
    await bob.getByRole("button", { name: "View group members" }).click();
    await expect(bob.getByText("Only admins can change this group.")).toBeVisible();
    await expect(bob.getByRole("button", { name: "Remove Carol Chen" })).toHaveCount(0);
    await bob.getByRole("button", { name: "Close dialog" }).click();
    await page.screenshot({ path: info.outputPath("phase5-group.png") });
    await page.getByRole("button", { name: "View group members" }).click();
    await page.getByRole("button", { name: "Remove Carol Chen" }).click();
    await expect(page.getByRole("dialog")).toContainText("2 members");
    await page.screenshot({ path: info.outputPath("phase5-group-admin.png") });
    await page.getByRole("button", { name: "Close dialog" }).click();
    await expect(carol.getByRole("region", { name: name + " conversation" })).toHaveCount(0);
    expect((await api(carol, `/api/conversations/${group.id}/messages`)).status).toBe(404);
    expect((await api(carol, `/api/conversations/${group.id}/messages`, "POST", { body: "Denied", client_message_id: crypto.randomUUID() })).status).toBe(404);
    await send(page, "Only remaining members");
    await expect(history(bob).getByText("Only remaining members", { exact: true })).toHaveCount(1);
    await expect(carol.getByText("Only remaining members", { exact: true })).toHaveCount(0);
  } finally { await bobContext.close(); await carolContext.close(); }
});
