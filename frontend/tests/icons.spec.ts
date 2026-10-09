import { test, expect } from "@playwright/test";

test("icon geometry and selected states survive desktop and mobile workflows", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill("alice");
  await page.getByLabel("Demo OTP").fill("123456");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByTestId("connection-status")).toHaveAttribute("data-state", "connected");
  const rail = page.getByRole("navigation", { name: "Main navigation" });
  const compose = page.getByRole("button", { name: "New chat", exact: true });
  const button = await compose.boundingBox(), svg = await compose.locator("svg").boundingBox();
  expect(button!.width).toBe(36); expect(button!.height).toBe(36);
  expect(svg!.width).toBe(24); expect(svg!.height).toBe(24);
  expect(svg!.x + svg!.width / 2).toBe(button!.x + button!.width / 2);
  expect(svg!.y + svg!.height / 2).toBe(button!.y + button!.height / 2);
  await expect(rail.getByRole("button", { name: "Chats", exact: true }).locator("svg")).toHaveAttribute("fill", "currentColor");
  await expect(rail.getByRole("button", { name: "Settings", exact: true }).locator("svg")).toHaveAttribute("fill", "none");
  await compose.focus(); await compose.press("Enter");
  await expect(page.getByLabel("Find a user")).toBeFocused();
  await page.getByRole("button", { name: "New group", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "New group", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Back to Chats" }).click();
  for (const name of ["Calls", "Stories"]) {
    await rail.getByRole("button", { name, exact: true }).click();
    await expect(page.getByRole("dialog", { name, exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close dialog" }).click();
  }
  await rail.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(rail.getByRole("button", { name: "Settings", exact: true }).locator("svg")).toHaveAttribute("fill", "currentColor");
  await expect(rail.getByRole("button", { name: "Chats", exact: true }).locator("svg")).toHaveAttribute("fill", "none");
  await expect(page.locator(".rail-bottom button")).toHaveCount(1);
  for (const name of ["Account", "General", "Appearance", "Chats", "Calls", "Notifications", "Privacy", "Data usage", "About"]) {
    await page.locator(".settings-nav").getByRole("button", { name, exact: true }).click();
    await expect(page.getByRole("region", { name: name + " settings", exact: true })).toBeVisible();
    const back = page.getByRole("button", { name: "Back to Settings" });
    if (await back.isVisible()) await back.click();
  }
  await page.screenshot({ path: info.outputPath("selected-gear.png") });
  await rail.getByRole("button", { name: "Chats", exact: true }).click();
  await page.getByRole("button", { name: /Weekend Plans/ }).click();
  for (const name of ["Emoji picker — coming soon; type emoji in your draft", "Voice messages — coming soon", "Attachments — coming soon"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeDisabled();
  }
  await page.getByRole("button", { name: "View group members" }).click();
  await expect(page.getByRole("dialog", { name: "Group details" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Rename group", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Search this conversation" }).click();
  await expect(page.getByLabel("Search loaded messages")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  const metrics = await page.locator("svg[data-icon]").evaluateAll(elements => elements.filter(el => el.getClientRects().length).map(el => {
    const svg = el as SVGSVGElement, drawing = svg.getBBox(), rect = svg.getBoundingClientRect();
    return { name: svg.dataset.icon, aspect: rect.width / rect.height, x: drawing.x, y: drawing.y, right: drawing.x + drawing.width, bottom: drawing.y + drawing.height };
  }));
  for (const metric of metrics) {
    expect(metric.aspect, metric.name).toBe(1);
    expect(metric.x, metric.name).toBeGreaterThanOrEqual(1);
    expect(metric.y, metric.name).toBeGreaterThanOrEqual(1);
    expect(metric.right, metric.name).toBeLessThanOrEqual(23);
    expect(metric.bottom, metric.name).toBeLessThanOrEqual(23);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
