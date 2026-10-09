import { test, expect } from "@playwright/test";

test("rail geometry, single bottom gear and centered empty search", async ({ page }, info) => {
  const mobile = info.project.name.includes("mobile");
  await page.setViewportSize(mobile ? { width: 390, height: 600 } : { width: 1440, height: 720 });
  await page.goto("/");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill("alice");
  await page.getByLabel("Demo OTP").fill("123456");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByTestId("connection-status")).toHaveAttribute("data-state", "connected");
  await expect(page.locator(".rail-bottom button")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Chats", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".preview-caption")).toHaveCount(0);
  const geometry = await page.evaluate(() => {
    const rail = document.querySelector(".navigation-rail")!.getBoundingClientRect();
    const sidebar = document.querySelector(".conversation-sidebar")!.getBoundingClientRect();
    const gear = document.querySelector(".rail-bottom button")!.getBoundingClientRect();
    return { rail: rail.width, sidebar: sidebar.width, gearCenter: gear.x + gear.width / 2, bottomInset: innerHeight - gear.bottom, overflow: document.documentElement.scrollWidth > innerWidth };
  });
  expect(geometry).toEqual({ rail: mobile ? 56 : 74, sidebar: mobile ? 334 : 300, gearCenter: mobile ? 27.5 : 36.5, bottomInset: 9, overflow: false });
  await page.screenshot({ path: info.outputPath("rail-empty-main.png") });
  await page.getByLabel("Search conversations and contacts").fill("unmatched_fidelity_query");
  await expect(page.getByText("No conversations found", { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("centered-empty-search.png") });
});

test("a chat hidden by Settings acknowledges delivery but waits for visible reading", async ({ browser, page }, info) => {
  test.skip(info.project.name.includes("mobile"), "Desktop preserves the selected pane behind Settings; mobile Back closes it.");
  const bobContext = await browser.newContext({ baseURL: "http://127.0.0.1:3100" });
  const bob = await bobContext.newPage();
  async function login(target: typeof page, username: string) {
    await target.goto("/");
    await target.getByRole("button", { name: "Log in", exact: true }).click();
    await target.getByLabel("Username", { exact: true }).fill(username);
    await target.getByLabel("Demo OTP").fill("123456");
    await target.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(target.getByTestId("connection-status")).toHaveAttribute("data-state", "connected");
  }
  try {
    await login(page, "alice"); await login(bob, "bob");
    await page.getByRole("button", { name: /Bob Patel/ }).first().click();
    await bob.getByRole("button", { name: /Alice Morgan/ }).first().click();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    const body = "Hidden settings receipt " + crypto.randomUUID();
    await bob.getByLabel("Message draft").fill(body);
    await bob.getByRole("button", { name: "Send message" }).click();
    const bubble = bob.locator(".message-bubble").filter({ hasText: body });
    await expect(bubble.getByLabel("Status: delivered", { exact: true })).toBeVisible();
    // Inspect durable receipt state after the hidden pane has received the frame.
    const snapshot = await page.request.get("/api/conversations/900001/messages?limit=50");
    const stored = (await snapshot.json()).messages.find((message: { body: string }) => message.body === body);
    expect(stored.status).toBe("delivered");
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Chats", exact: true }).click();
    await expect(page.getByRole("region", { name: "Message history" }).getByText(body, { exact: true })).toBeVisible();
    await expect(bubble.getByLabel("Status: read", { exact: true })).toBeVisible();
  } finally { await bobContext.close(); }
});

test("settings and new chat stay in the shell and preserve the selected draft", async ({ page }, info) => {
  const mobile = info.project.name.includes("mobile");
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 720 });
  await page.goto("/");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill("alice");
  await page.getByLabel("Demo OTP").fill("123456");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByTestId("connection-status")).toHaveAttribute("data-state", "connected");
  await page.getByRole("button", { name: /Bob Patel/ }).first().click();
  await page.getByLabel("Message draft").fill("Unsent draft survives shell navigation");
  if (mobile) await page.getByRole("button", { name: "Back to conversations" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: info.outputPath("settings-index.png") });
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await expect(page.getByRole("region", { name: "Profile settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Profile", exact: true })).toBeFocused();
  await page.screenshot({ path: info.outputPath("settings-profile.png") });
  if (!mobile) {
    const bounds = await page.locator(".settings-page").boundingBox();
    expect(bounds).toEqual({ x: 374, y: 0, width: 1066, height: 720 });
  }
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Chats", exact: true }).click();
  if (mobile) await page.getByRole("button", { name: /Bob Patel/ }).first().click();
  // Desktop switches shell views with the conversation still selected. Mobile Back
  // explicitly closes the conversation, retaining the existing draft lifecycle.
  await expect(page.getByLabel("Message draft")).toHaveValue(mobile ? "" : "Unsent draft survives shell navigation");
  if (mobile) await page.getByRole("button", { name: "Back to conversations" }).click();
  else await page.getByRole("button", { name: "Chats", exact: true }).click();
  await page.getByRole("button", { name: "New chat", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Find a user")).toBeFocused();
  await page.screenshot({ path: info.outputPath("new-chat-sidebar.png") });
  await page.getByLabel("Find a user").fill("dave");
  await expect(page.getByRole("complementary", { name: "New chat", exact: true }).getByRole("button", { name: /Dave/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "New chat", exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
