/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, test, type Locator } from "@playwright/test";

// Run against a local Vite server. The fixture mounts the production panel and styles.
test.beforeEach(async ({ page }) => {
  await page.route("**/src/main.tsx", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'import "/studio/tests/e2e/fixtures/resource-preview.tsx";',
    }),
  );
});

async function geometry(value: Locator) {
  return value.evaluate((element) => {
    const cell = element.closest("td")!;
    const style = getComputedStyle(cell);
    return {
      width: element.clientWidth,
      contentWidth: element.scrollWidth,
      available: cell.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
      ellipsis: getComputedStyle(element).textOverflow,
    };
  });
}

test("text follows the actual column width and full values remain accessible", async ({
  page,
  context,
}, testInfo) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/studio/");
  const branch = page.getByRole("button", { name: "feat/bkn-safe/casdoor-sso", exact: true });
  const mixed = page.getByRole("button", {
    name: "宽列中可以完整显示的中文文本 mixed 👩🏽‍💻",
    exact: true,
  });
  await expect(branch).toBeVisible();
  for (const value of [branch, mixed]) {
    const box = await geometry(value);
    expect(box.width).toBeGreaterThan(280);
    expect(box.contentWidth).toBeLessThanOrEqual(box.width);
    expect(Math.abs(box.width - box.available)).toBeLessThanOrEqual(1);
  }
  const longText = page.locator("tbody tr").nth(2).getByRole("button").first();
  const longBox = await geometry(longText);
  expect(longBox.contentWidth).toBeGreaterThan(longBox.width);
  await page.screenshot({ path: testInfo.outputPath("wide.png") });

  await page.setViewportSize({ width: 360, height: 800 });
  await expect.poll(async () => (await geometry(branch)).width).toBeLessThan(280);
  const narrowBox = await geometry(branch);
  expect(narrowBox.contentWidth).toBeGreaterThan(narrowBox.width);
  expect(narrowBox.ellipsis).toBe("ellipsis");
  const mixedValue = "中文字段内容测试窄列溢出👩🏽‍💻 / narrow preview value overflows";
  const shortText = page.getByRole("button", { name: mixedValue, exact: true });
  expect((await geometry(shortText)).contentWidth).toBeGreaterThan(
    (await geometry(shortText)).width,
  );
  await page.screenshot({ path: testInfo.outputPath("narrow.png") });
  await shortText.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("pre")).toHaveText(mixedValue);
  await dialog.getByRole("button", { name: /复制完整内容|Copy full value/ }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(mixedValue);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();

  await page.setViewportSize({ width: 1280, height: 800 });
  // Enlarging text exercises the same overflow boundary as browser text scaling.
  await branch.evaluate((element) => ((element as HTMLElement).style.fontSize = "26px"));
  const scaledBox = await geometry(branch);
  expect(scaledBox.contentWidth).toBeLessThanOrEqual(scaledBox.width);
  expect(await branch.textContent()).toBe("feat/bkn-safe/casdoor-sso");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
});

test("many columns scroll within the preview instead of widening the page", async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 800 });
  await page.goto("/studio/?many");
  await expect(page.locator("tbody tr")).toHaveCount(3);
  const overflow = await page.locator("table").evaluate((table) => {
    const wrapper = table.parentElement!;
    wrapper.scrollLeft = wrapper.scrollWidth;
    return {
      scrollWidth: wrapper.scrollWidth,
      width: wrapper.clientWidth,
      scrolled: wrapper.scrollLeft,
      pageWidth: document.documentElement.scrollWidth,
    };
  });
  expect(overflow.scrollWidth).toBeGreaterThan(overflow.width);
  expect(overflow.scrolled).toBeGreaterThan(0);
  expect(overflow.pageWidth).toBeLessThanOrEqual(720);
});

test("oversized text remains accessible when Intl.Segmenter is unavailable", async ({
  page,
  context,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => {
    Object.defineProperty(Intl, "Segmenter", { value: undefined, configurable: true });
  });
  await page.goto("/studio/?oversized");
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "feat/bkn-safe/casdoor-sso", exact: true }),
  ).toBeVisible();
  const preview = page.locator("tbody tr").nth(2).getByRole("button").first();
  await expect(preview).toHaveText("…");
  await preview.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  const original = `${"x".repeat(9_999)}👩🏽‍💻e\u0301${"尾".repeat(20_000)}`;
  await expect(dialog).toBeVisible();
  expect(await dialog.locator("pre").textContent()).toBe(original);
  await dialog.getByRole("button", { name: /复制完整内容|Copy full value/ }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(original);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(preview).toBeFocused();
  expect(pageErrors).toEqual([]);
});

test("whitespace values have field-specific names and copy unchanged", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/studio/?whitespace");
  const preview = page.getByRole("button", { name: /^(完整内容：name|Full value: name)$/ });
  await expect(preview).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^(完整内容：description|Full value: description)$/ }),
  ).toBeVisible();
  await preview.focus();
  await expect(preview).toBeFocused();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(await dialog.locator("pre").textContent()).toBe("\n\t ");
  await dialog.getByRole("button", { name: /复制完整内容|Copy full value/ }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("\n\t ");
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(preview).toBeFocused();
});

for (const width of [720, 1280]) {
  test(`long headers reveal complete field metadata at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/studio/?long-headers");
    for (const field of [
      { name: "reporting_customer_profile_recent_review_request_comment_count" },
      {
        name: "reporting_customer_profile_recent_review_request_comment_total",
        displayName: "客户档案最近审核评论总数 / Recent review request comment total",
        description: "Read-only source field description",
      },
    ]) {
      const header = page.getByRole("columnheader", { name: new RegExp(field.name) });
      const trigger = header.getByRole("button", { name: new RegExp(field.name) });
      await expect(trigger).toBeVisible();
      const label = trigger.getByText(field.displayName ?? field.name, { exact: true });
      const sizes = await label.evaluate((element) => ({
        width: element.clientWidth,
        contentWidth: element.scrollWidth,
      }));
      if (width === 720) expect(sizes.contentWidth).toBeGreaterThan(sizes.width);
      else expect(sizes.contentWidth).toBeLessThanOrEqual(sizes.width);
      await trigger.hover();
      const tooltip = page.getByRole("tooltip");
      await expect(tooltip.getByText(field.name, { exact: true })).toBeVisible();
      if (field.displayName)
        await expect(tooltip.getByText(field.displayName, { exact: true })).toBeVisible();
      if (field.description)
        await expect(tooltip.getByText(field.description, { exact: true })).toBeVisible();
      await page.mouse.move(0, 0);
      await expect(tooltip).not.toBeVisible();
      await trigger.focus();
      await expect(tooltip.getByText(field.name, { exact: true })).toBeVisible();
      await expect(trigger).toHaveAccessibleDescription(field.description ?? "");
      await expect(page.getByRole("tooltip")).toHaveCount(1);
      await trigger.evaluate((element) => (element as HTMLElement).blur());
      await expect(tooltip).not.toBeVisible();
      await trigger.click();
      await expect(tooltip.getByText(field.name, { exact: true })).toBeVisible();
      await page.mouse.click(0, 0);
      await expect(tooltip).not.toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  });
}
