import { test, expect, type Page, type WebSocketRoute } from "@playwright/test";

const origin = "http://127.0.0.1:3100";
async function login(page: Page, username: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Demo OTP").fill("123456");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Profile:/ })).toBeVisible();
  await expect(page.getByText("Messages · connected")).toBeVisible();
}
async function back(page: Page) {
  const button = page.getByRole("button", { name: "Back to conversations" });
  if (await button.isVisible()) await button.click();
  else await page.getByRole("button", { name: "Chats", exact: true }).click();
}

test("seeded conversations, directory, contacts, search and group scope", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await login(page, "alice");
  const rows = page.locator(".conversation-row");
  await expect(page.getByRole("button", { name: /Weekend Plans/ })).toBeVisible();
  expect(await rows.count()).toBeGreaterThanOrEqual(3);
  await page.getByLabel("Search conversations and contacts").fill("carol");
  await expect(rows).toHaveCount(2); // Carol direct chat and shared Weekend Plans group
  await page.getByLabel("Search conversations and contacts").fill("nobody-at-all");
  await expect(page.getByText("No conversations found")).toBeVisible();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await page.getByRole("button", { name: "Filter by unread" }).click();
  const unread = await page.request.get("/api/conversations?filter=unread");
  await expect(rows).toHaveCount((await unread.json()).conversations.length);
  await page.getByRole("button", { name: "Clear filter" }).click();
  await page.getByRole("button", { name: /Weekend Plans/ }).click();
  await expect(page.getByRole("button", { name: "Send message" })).toBeDisabled();
  await page.getByRole("button", { name: "View group members" }).click();
  await expect(page.getByText("Admin", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Add members", { exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await back(page);
  await page.getByRole("button", { name: "New chat", exact: true }).click();
  await page.getByLabel("Find a user").fill("dave");
  await expect(page.getByRole("button", { name: /Dave/ })).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Conversation list menu" }).click();
  await page.getByRole("menuitem", { name: "New contact" }).click();
  await page.getByLabel("Username", { exact: true }).fill("dave");
  await expect(page.getByText("Matches: @dave")).toBeVisible();
  await page.getByRole("button", { name: "Add contact" }).click();
  await expect(page.getByRole("status")).toContainText("in your contacts");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "New chat", exact: true }).click();
  await expect(page.getByRole("button", { name: /Dave/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test("two sessions exchange persistent direct messages", async ({ browser, page }, testInfo) => {
  const bobContext = await browser.newContext({ baseURL: origin, viewport: testInfo.project.use.viewport });
  const bob = await bobContext.newPage();
  const firstLine = `Phase 4 ${testInfo.project.name} ${crypto.randomUUID()}`;
  const message = firstLine + "\nsecond line";
  try {
    await login(page, "alice");
    await login(bob, "bob");
    await page.getByRole("button", { name: /Bob Patel/ }).first().click();
    await bob.getByRole("button", { name: /Alice Morgan/ }).first().click();
    const draft = page.getByLabel("Message draft");
    await draft.fill(firstLine);
    await draft.press("Shift+Enter");
    await draft.pressSequentially("second line");
    await expect(draft).toHaveValue(message);
    await draft.press("Enter");
    await expect(page.getByRole("region", { name: "Message history" }).getByText(message, { exact: true })).toHaveCount(1);
    await expect(bob.getByRole("region", { name: "Message history" }).getByText(message, { exact: true })).toHaveCount(1);
    await page.reload();
    await expect(page.getByRole("button", { name: "Profile: Alice Morgan" })).toBeVisible();
    await page.getByRole("button", { name: /Bob Patel/ }).first().click();
    await expect(page.getByRole("region", { name: "Message history" }).getByText(message, { exact: true })).toHaveCount(1);
    await bob.reload();
    await expect(bob.getByRole("button", { name: "Profile: Bob Patel" })).toBeVisible();
    await bob.getByRole("button", { name: /Alice Morgan/ }).first().click();
    await expect(bob.getByRole("region", { name: "Message history" }).getByText(message, { exact: true })).toHaveCount(1);
    const reply = `Reply ${crypto.randomUUID()}`;
    await bob.getByLabel("Message draft").fill(reply);
    await bob.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("region", { name: "Message history" }).getByText(reply, { exact: true })).toHaveCount(1);
    await page.screenshot({ path: testInfo.outputPath("alice-live.png"), animations: "disabled" });
    await bob.screenshot({ path: testInfo.outputPath("bob-live.png"), animations: "disabled" });
    await back(bob);
    await bob.getByRole("button", { name: "Settings", exact: true }).click();
    await bob.getByRole("button", { name: "Log out", exact: true }).click();
    await expect(bob.getByRole("button", { name: "Log in", exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Profile: Alice Morgan" })).toBeVisible();
  } finally { await bobContext.close(); }
});

test("chat menus, loaded search, settings and placeholder dialogs retain keyboard behavior", async ({ page }) => {
  await login(page, "alice");
  let releaseHistory = () => {};
  const gate = new Promise<void>(resolve => { releaseHistory = resolve; });
  await page.route(/\/api\/conversations\/900001\/messages\?limit=50$/, async route => {
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response });
  });
  await page.getByRole("button", { name: /Bob Patel/ }).first().click();
  await page.getByRole("button", { name: "Search this conversation" }).click();
  await page.getByLabel("Search loaded messages").fill("see you");
  await expect(page.locator(".search-results article")).toHaveCount(0);
  releaseHistory();
  await expect(page.locator(".search-results article")).toHaveCount(1);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Chat menu", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Contact details" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "Search conversation" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Chat menu", exact: true })).toBeFocused();
  await back(page);
  await page.getByRole("button", { name: "New chat", exact: true }).click();
  await page.getByLabel("Find a user").fill("nobody_at_all");
  await expect(page.getByText("No users found.")).toBeVisible();
  await page.getByRole("button", { name: "New group", exact: true }).click();
  await page.getByLabel("Group name").fill("Picnic");
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "choose at least one member" })).toBeVisible();
  await page.getByRole("checkbox", { name: /Bob Patel/ }).check();
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page.getByRole("region", { name: "Picnic conversation" })).toBeVisible();
  await back(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByText("@alice", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Privacy", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Read receipts (preview)" })).toBeDisabled();
  await page.getByRole("button", { name: "Notifications", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Message notifications (preview)" })).toBeDisabled();
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await expect(page.getByText("Light", { exact: true })).toBeVisible();
  for (let index = 0; index < 7; index++) await page.keyboard.press("Tab");
  expect(await page.evaluate(() => !!document.activeElement?.closest("dialog"))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeFocused();
  for (const name of ["Calls", "Stories"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.getByRole("dialog", { name })).toContainText("coming soon");
    await page.getByRole("button", { name: "Close dialog" }).click();
  }
});

test("new direct thread appears for both members; new account starts empty", async ({ browser, page }, testInfo) => {
  const freshContext = await browser.newContext({ baseURL: origin, viewport: testInfo.project.use.viewport });
  const fresh = await freshContext.newPage();
  const username = `phase4_${testInfo.project.name.includes("mobile") ? "mobile" : "desktop"}`;
  try {
    await login(page, "alice");
    await fresh.goto("/");
    await fresh.getByLabel("Username", { exact: true }).fill(username);
    await fresh.getByLabel("Display name", { exact: true }).fill("Fresh User");
    await fresh.getByLabel("Demo OTP").fill("123456");
    await fresh.getByRole("button", { name: "Create demo account" }).click();
    await expect(fresh.getByRole("button", { name: "Profile: Fresh User" })).toBeVisible();
    await expect(fresh.locator(".conversation-row")).toHaveCount(0);
    await expect(fresh.getByText("No conversations yet")).toBeVisible();
    await page.getByRole("button", { name: "New chat", exact: true }).click();
    await page.getByLabel("Find a user").fill(username);
    await page.getByRole("dialog").getByRole("button", { name: /Fresh User/ }).click();
    await expect(page.getByLabel(/Fresh User conversation/)).toBeVisible();
    await expect(fresh.locator(".conversation-row")).toHaveCount(1);
    await expect(fresh.getByRole("button", { name: /Alice Morgan/ }).first()).toBeVisible();
    await fresh.reload();
    await expect(fresh.locator(".conversation-row")).toHaveCount(1);
  } finally { await freshContext.close(); }
});

test("socket reconnection restores missed message from durable history", async ({ browser, page }, testInfo) => {
  const bobContext = await browser.newContext({ baseURL: origin, viewport: testInfo.project.use.viewport });
  const bob = await bobContext.newPage();
  const control: { first?: WebSocketRoute; allowReconnect: boolean; attempts: number } = { allowReconnect: false, attempts: 0 };
  try {
    await page.routeWebSocket("ws://127.0.0.1:8100/v1/ws", route => {
      control.attempts++;
      if (control.attempts === 1) control.first = route;
      if (control.attempts === 1 || control.allowReconnect) route.connectToServer();
      else void route.close({ code: 1012 });
    });
    await login(page, "alice");
    await login(bob, "bob");
    await page.getByRole("button", { name: /Bob Patel/ }).first().click();
    await bob.getByRole("button", { name: /Alice Morgan/ }).first().click();
    expect(control.first).toBeDefined();
    await control.first!.close({ code: 1012 });
    await expect(page.locator(".preview-caption")).toHaveText("Messages · reconnecting");
    const missed = `While offline ${crypto.randomUUID()}`;
    await bob.getByLabel("Message draft").fill(missed);
    await bob.getByRole("button", { name: "Send message" }).click();
    await expect(bob.getByText(missed, { exact: true })).toHaveCount(1);
    control.allowReconnect = true;
    await expect(page.locator(".preview-caption")).toHaveText("Messages · connected", { timeout: 20000 });
    await expect(page.getByRole("region", { name: "Message history" }).getByText(missed, { exact: true })).toHaveCount(1);
  } finally {
    await bobContext.close();
  }
});

test("a delayed real history snapshot preserves a newer live message", async ({ browser, page }, testInfo) => {
  const bobContext = await browser.newContext({ baseURL: origin, viewport: testInfo.project.use.viewport });
  const bob = await bobContext.newPage();
  let releaseSnapshot = () => {};
  let snapshotReady = () => {};
  const release = new Promise<void>(resolve => { releaseSnapshot = resolve; });
  const ready = new Promise<void>(resolve => { snapshotReady = resolve; });
  try {
    await login(page, "alice");
    await login(bob, "bob");
    await bob.getByRole("button", { name: /Alice Morgan/ }).first().click();
    await page.route(/\/api\/conversations\/900001\/messages\?limit=50$/, async route => {
      const response = await route.fetch(); // Real FastAPI snapshot; only its timing changes.
      snapshotReady();
      await release;
      await route.fulfill({ response });
    });
    await page.getByRole("button", { name: /Bob Patel/ }).first().click();
    await ready;
    const live = `Snapshot race ${crypto.randomUUID()}`;
    await bob.getByLabel("Message draft").fill(live);
    await bob.getByRole("button", { name: "Send message" }).click();
    const history = page.getByRole("region", { name: "Message history" });
    await expect(history.getByText(live, { exact: true })).toHaveCount(1);
    releaseSnapshot();
    await expect(history.getByText("Hi Bob, welcome to the demo.", { exact: true })).toBeVisible();
    await expect(history.getByText(live, { exact: true })).toHaveCount(1);
  } finally {
    releaseSnapshot();
    await bobContext.close();
  }
});

test("real-data screenshots and viewport geometry", async ({ page }, testInfo) => {
  const mobile = testInfo.project.name.includes("mobile");
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
  await login(page, "alice");
  const capture = (name: string) => page.screenshot({ path: testInfo.outputPath(name + ".png"), animations: "disabled" });
  await capture(mobile ? "mobile-list" : "desktop-empty-1440");
  await page.getByRole("button", { name: /Bob Patel/ }).first().click();
  await expect(page.getByRole("region", { name: "Message history" }).locator(".message-bubble")).not.toHaveCount(0);
  await capture(mobile ? "mobile-direct" : "desktop-direct-1440");
  await back(page);
  await page.getByRole("button", { name: /Weekend Plans/ }).click();
  await expect(page.getByRole("region", { name: "Message history" }).locator(".message-bubble")).toHaveCount(2);
  await capture(mobile ? "mobile-group" : "desktop-group-1440");
  const sizes = mobile ? [{ width: 390, height: 844 }] : [{ width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 1024, height: 768 }];
  for (const size of sizes) {
    await page.setViewportSize(size);
    await expect(page.getByLabel("Message draft")).toBeVisible();
    expect(await page.evaluate(() => ({ width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth, bottom: document.querySelector(".composer-area")!.getBoundingClientRect().bottom }))).toEqual({ ...size, overflow: false, bottom: size.height });
    await capture(`group-${size.width}x${size.height}`);
  }
  if (!mobile) await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "View group members" }).click();
  await capture(mobile ? "mobile-members" : "desktop-members");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await back(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Privacy", exact: true }).click();
  await capture(mobile ? "mobile-settings" : "desktop-settings");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "New chat", exact: true }).click();
  await page.getByRole("button", { name: "New group", exact: true }).click();
  await capture(mobile ? "mobile-new-group" : "desktop-new-group");
});
