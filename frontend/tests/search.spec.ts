import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, username = "alice") {
  await page.goto("/");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Demo OTP").fill("123456");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByTestId("connection-status")).toHaveAttribute("data-state", "connected");
}
async function back(page: Page) {
  const button = page.getByRole("button", { name: "Back to conversations", exact: true });
  if (await button.isVisible()) await button.click();
  else await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Chats", exact: true }).click();
}
async function send(page: Page, body: string) {
  await page.getByLabel("Message draft").fill(body);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.locator(".message-row").filter({ hasText: body })).toBeVisible();
}

test("one sidebar input handles global, direct and group search, result jumps and scope exits", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await login(page);
  const global = page.getByLabel("Search conversations and contacts");
  await global.fill("bob");
  await expect(page.getByRole("button", { name: /^Bob Patel/ })).toHaveCount(1);
  await global.fill("carol"); // Includes groups through a contact's username/name.
  await expect(page.getByRole("button", { name: /Weekend Plans/ })).toBeVisible();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await page.getByRole("button", { name: /Bob Patel/ }).first().click();
  const direct = "Direct search " + crypto.randomUUID().slice(0, 8);
  await send(page, direct);
  await page.getByLabel("Message draft").fill("Unsent draft stays here");
  await page.getByRole("button", { name: "Search this conversation" }).click();
  const scoped = page.getByPlaceholder("Search chat");
  await expect(scoped).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".search-scope-chip")).toHaveAttribute("title", "Search in Bob Patel");
  const inputId = await scoped.evaluate(input => { input.setAttribute("data-shared-input", "true"); return input.getAttribute("data-shared-input"); });
  expect(inputId).toBe("true");
  await scoped.fill("  " + direct.toUpperCase() + "  ");
  const result = page.locator(".message-search-result");
  await expect(result).toHaveCount(1);
  await expect(result).toContainText("Alice Morgan");
  await expect(result.locator("time")).not.toBeEmpty();
  if (!info.project.name.includes("mobile")) await expect(page.getByLabel("Message draft")).toBeVisible();
  else await expect(page.getByLabel("Message draft")).not.toBeVisible();
  await result.click();
  const target = page.locator(".message-row.search-match");
  await expect(target).toContainText(direct);
  await expect(target).toBeInViewport();
  await expect(target).toBeFocused();
  await expect(page.getByLabel("Message draft")).toHaveValue("Unsent draft stays here");
  await expect(target).toHaveCount(0, { timeout: 4000 });
  await page.getByLabel("Message draft").fill("");
  await page.getByRole("button", { name: "Search this conversation" }).click();
  await scoped.fill("no-such-message-xyz");
  await expect(page.getByText("No matching loaded messages")).toBeVisible();
  await scoped.press("Escape");
  await expect(global).toBeFocused();
  await expect(global).toHaveAttribute("data-shared-input", "true");
  await expect(global).toHaveValue("");
  await page.getByRole("button", { name: "Filter by unread" }).click();
  await expect(page.getByText("Filtered by unread")).toBeVisible();
  await page.getByRole("button", { name: "Clear filter" }).click();
  await global.fill("weekend");
  await page.getByRole("button", { name: /Weekend Plans/ }).click();
  const group = "Group search " + crypto.randomUUID().slice(0, 8);
  await send(page, group);
  await page.getByRole("button", { name: "Chat menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Search conversation", exact: true }).click();
  await expect(scoped).toBeFocused();
  await expect(scoped).toHaveValue("");
  await expect(page.locator(".search-scope-chip")).toHaveAttribute("title", "Search in Weekend Plans");
  await scoped.fill(direct);
  await expect(page.getByText("No matching loaded messages")).toBeVisible();
  await scoped.fill(group);
  await expect(result).toHaveCount(1);
  await result.click();
  await expect(page.locator(".message-row.search-match")).toContainText(group);
  await page.getByRole("button", { name: "Search this conversation" }).click();
  await page.getByRole("button", { name: "Remove conversation search" }).click();
  await expect(global).toBeFocused();
  await expect(global).toHaveValue("");
  if (info.project.name.includes("mobile")) await page.getByRole("button", { name: "Return to conversation" }).click();
  await expect(page.getByRole("region", { name: "Weekend Plans conversation" })).toBeVisible();
  await back(page);
  await page.getByRole("button", { name: /Bob Patel/ }).first().click();
  await page.getByRole("button", { name: "Search this conversation" }).click();
  await expect(page.locator(".search-scope-chip")).toHaveAttribute("title", "Search in Bob Patel");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("loaded-history search states its limit and jumps to an earlier page after loading it", async ({ page }, info) => {
  test.setTimeout(60000);
  await login(page);
  const anchor = "Earlier search anchor " + crypto.randomUUID().slice(0, 8);
  // Use an isolated new group to avoid changing other tests' seed history assumptions.
  const created = await page.evaluate(async name => {
    const me = await (await fetch("/api/auth/me")).json();
    const response = await fetch("/api/conversations/groups", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": me.csrf_token }, body: JSON.stringify({ name, user_ids: [900002] }) });
    const value = await response.json();
    if (response.status !== 201) throw new Error("Could not create test group");
    for (let i = 0; i < 54; i++) {
      const sent = await fetch(`/api/conversations/${value.conversation.id}/messages`, { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": me.csrf_token }, body: JSON.stringify({ body: i === 0 ? name : `Search filler ${i}`, client_message_id: crypto.randomUUID() }) });
      if (sent.status !== 201) throw new Error("Could not populate real history");
    }
    return value.conversation.id;
  }, anchor);
  expect(created).toBeGreaterThan(0);
  await page.reload(); // Discard the live cache to exercise a genuinely partial history page.
  await expect(page.getByTestId("connection-status")).toHaveAttribute("data-state", "connected");
  await page.getByRole("button", { name: new RegExp(anchor) }).click();
  await expect(page.locator(".message-row")).toHaveCount(50);
  await page.getByRole("button", { name: "Search this conversation" }).click();
  await expect(page.getByText("Searches loaded messages only.", { exact: false })).toContainText("Load older messages");
  await page.getByPlaceholder("Search chat").fill(anchor);
  await expect(page.getByText("No matching loaded messages")).toBeVisible();
  if (info.project.name.includes("mobile")) await page.getByRole("button", { name: "Return to conversation" }).click();
  await page.getByRole("button", { name: "Load older messages" }).click();
  await expect(page.locator(".message-row")).toHaveCount(54);
  await page.getByRole("region", { name: "Message history" }).evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(page.locator(".message-row").filter({ hasText: anchor })).not.toBeInViewport();
  await page.getByRole("button", { name: "Search this conversation" }).click();
  await page.getByPlaceholder("Search chat").fill(anchor);
  await expect(page.locator(".message-search-result")).toHaveCount(1);
  await page.locator(".message-search-result").click();
  await expect(page.locator(".message-row.search-match")).toContainText(anchor);
  await expect(page.locator(".message-row.search-match")).toBeInViewport();
  await page.screenshot({ path: info.outputPath("earlier-search-result.png") });
});

test("search remains live and hidden mobile history does not mark new messages read", async ({ page, browser }, info) => {
  const other = await browser.newContext({ baseURL: "http://127.0.0.1:3100", viewport: info.project.use.viewport });
  const bob = await other.newPage();
  try {
    await login(page); await login(bob, "bob");
    await page.getByRole("button", { name: /Bob Patel/ }).first().click();
    await bob.getByRole("button", { name: /Alice Morgan/ }).first().click();
    await page.getByRole("button", { name: "Search this conversation" }).click();
    const body = "Live search " + crypto.randomUUID().slice(0, 8);
    await page.getByPlaceholder("Search chat").fill(body);
    await send(bob, body);
    await expect(page.locator(".message-search-result")).toContainText(body);
    const bubble = bob.locator(".message-bubble").filter({ hasText: body });
    if (info.project.name.includes("mobile")) {
      await expect(bubble.getByLabel("Status: delivered", { exact: true })).toBeVisible();
      await expect(bubble.getByLabel("Status: read", { exact: true })).toHaveCount(0);
    }
    await page.locator(".message-search-result").click();
    await expect(bubble.getByLabel("Status: read", { exact: true })).toBeVisible();
    await back(page);
    await page.getByRole("button", { name: "Filter by unread" }).click();
    await expect(page.getByRole("button", { name: /Bob Patel/ })).toHaveCount(0);
  } finally { await other.close(); }
});
