import { test, expect, type Page } from "@playwright/test";

async function openProfile(page: Page) {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Profile", exact: true }).click();
}

test("profile save, cancel, validation, session retention and fresh login", async ({ page, context }, info) => {
  const username = "profile_" + (info.project.name.includes("mobile") ? "mobile" : "desktop");
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("radio")).toHaveCount(4);
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Display name", { exact: true }).fill("Original Demo");
  await page.getByRole("radio", { name: "Fern", exact: true }).check();
  await page.getByLabel("Demo OTP").fill("123456");
  const registered = page.waitForResponse(response => response.url().endsWith("/api/auth/register") && response.status() === 201);
  await page.getByRole("button", { name: "Create demo account" }).click();
  const originalAuth = await (await registered).json();
  const session = (await context.cookies()).find(cookie => cookie.name === "scaler_session")!.value;
  await expect(page.getByTestId("connection-status")).toHaveAttribute("data-state", "connected");
  await page.getByRole("button", { name: "New chat", exact: true }).click();
  await page.getByLabel("Find a user").fill("bob");
  await page.getByRole("complementary", { name: "New chat", exact: true }).getByRole("button", { name: /Bob Patel/ }).click();
  await expect(page.getByLabel("Message draft")).toBeVisible();
  if (info.project.name.includes("mobile")) await page.getByRole("button", { name: "Back to conversations" }).click();
  // Populate the member cache before editing, to prove it cannot override our fresh profile.
  await page.getByRole("button", { name: "Conversation list menu" }).click();
  await page.getByRole("menuitem", { name: "New group", exact: true }).click();
  await page.getByLabel("Group name").fill("Profile cache " + username);
  await page.getByRole("checkbox", { name: /Bob Patel/ }).check();
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page.getByLabel("Message draft")).toBeVisible();
  if (info.project.name.includes("mobile")) await page.getByRole("button", { name: "Back to conversations" }).click();
  await openProfile(page);
  const form = page.getByRole("form", { name: "Edit profile" });
  const name = form.getByLabel("Display name", { exact: true });
  await expect(form.getByRole("radio", { name: "Fern", exact: true })).toBeChecked();
  await expect(form.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  await name.fill("Discard this");
  await form.getByRole("radio", { name: "Sun", exact: true }).check();
  await form.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(name).toHaveValue("Original Demo");
  await expect(name).toBeFocused();
  await expect(form.getByRole("radio", { name: "Fern", exact: true })).toBeChecked();
  let patches = 0;
  page.on("request", request => { if (request.method() === "PATCH" && request.url().endsWith("/api/users/me")) patches++; });
  for (const invalid of ["   ", "x".repeat(81)]) {
    await name.fill(invalid); await form.getByRole("button", { name: "Save", exact: true }).click();
    await expect(form.getByRole("alert")).toContainText("1–80 characters");
  }
  expect(patches).toBe(0);
  await name.fill("  Polished Demo  ");
  await form.getByRole("radio", { name: "Clay", exact: true }).check();
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/users/me", async route => { const response = await route.fetch(); await gate; await route.fulfill({ response }); });
  try {
    await form.getByRole("button", { name: "Save", exact: true }).click();
    await expect(form.getByRole("button", { name: "Saving…", exact: true })).toBeDisabled();
    await expect(name).toBeDisabled();
    release();
    await expect(form.getByRole("status")).toHaveText("Profile saved.");
  } finally { release(); await page.unroute("**/api/users/me"); }
  await expect(name).toHaveValue("Polished Demo");
  await expect(page.locator(".settings-account strong")).toHaveText("Polished Demo");
  await expect(page.locator(".settings-account img")).toHaveAttribute("src", "/avatars/clay.svg");
  expect((await context.cookies()).find(cookie => cookie.name === "scaler_session")!.value).toBe(session);
  const me = await (await context.request.get("/api/auth/me")).json();
  expect(me.csrf_token).toBe(originalAuth.csrf_token);
  expect(me.expires_at).toBe(originalAuth.expires_at);
  await expect(name).toBeFocused();
  await page.screenshot({ path: info.outputPath("profile-editor.png") });
  // Exercise a real mobile tap before the optional hardware-keyboard shortcut.
  if (info.project.name.includes("mobile")) await name.click();
  await expect(name).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(form).toHaveCount(0);
  await page.getByRole("button", { name: new RegExp("Profile cache " + username) }).click();
  await page.getByRole("button", { name: "View group members" }).click();
  await expect(page.locator(".member-row").filter({ hasText: "Polished Demo" }).locator("img")).toHaveAttribute("src", "/avatars/clay.svg");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByLabel("Message draft").fill("Profile save keeps messaging authenticated");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator(".message-row").filter({ hasText: "Profile save keeps messaging authenticated" })).toBeVisible();
  await page.reload();
  await openProfile(page);
  await expect(name).toHaveValue("Polished Demo");
  await expect(form.getByRole("radio", { name: "Clay", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page.getByRole("button", { name: "Log in", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Demo OTP").fill("123456");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByTestId("connection-status")).toHaveAttribute("data-state", "connected");
  await openProfile(page);
  await expect(name).toHaveValue("Polished Demo");
  await expect(form.getByRole("radio", { name: "Clay", exact: true })).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("profile request failure preserves saved state and allows retry", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill("alice");
  await page.getByLabel("Demo OTP").fill("123456");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByTestId("connection-status")).toHaveAttribute("data-state", "connected");
  await openProfile(page);
  const form = page.getByRole("form", { name: "Edit profile" });
  await form.getByLabel("Display name", { exact: true }).fill("Unsaved draft");
  await form.getByRole("radio", { name: "Sun", exact: true }).check();
  await page.route("**/api/users/me", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "UNAVAILABLE", message: "Profile temporarily unavailable." } }) }));
  await form.getByRole("button", { name: "Save", exact: true }).click();
  await expect(form.getByRole("alert")).toHaveText("Profile temporarily unavailable.");
  await expect(form.getByRole("status")).toHaveCount(0);
  await expect(page.locator(".settings-account strong")).toHaveText("Alice Morgan");
  await expect(form.getByLabel("Display name", { exact: true })).toHaveValue("Unsaved draft");
  await expect(form.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
  await page.unroute("**/api/users/me");
  await form.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(form.getByLabel("Display name", { exact: true })).toHaveValue("Alice Morgan");
  await expect(form.getByRole("radio", { name: "Sky", exact: true })).toBeChecked();
  const me = await (await page.request.get("/api/auth/me")).json();
  expect(me.user.display_name).toBe("Alice Morgan");
});
