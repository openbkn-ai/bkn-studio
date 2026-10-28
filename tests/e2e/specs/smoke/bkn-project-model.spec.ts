/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, test } from "@playwright/test";

// Run against a local Studio dev server in mock mode (VITE_USE_MOCK=true). The mock keeps the
// draft in memory, so the flow stays on one page load: a reload would start the draft over.
test("bkn project: draft, choose an identity, adopt, and see the changes", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("bkn-studio:locale", "zh-CN"));

  await page.goto("/studio/bkn-project");
  await page.getByText("Delivery Delay Warning").first().click();
  await page.getByRole("button", { name: "本体建模", exact: true }).click();

  // Drafting again over a draft nobody has changed starts at once, then reads the draft until done.
  await page.getByRole("button", { name: "重新起草" }).click();
  await expect(page.getByText("起草中").first()).toBeVisible();
  const adopt = page.getByRole("switch", { name: "采纳material_bom" });
  await expect(adopt).toBeVisible();
  // An object type without an identity cannot be adopted yet.
  await expect(adopt).toBeDisabled();

  await page.getByRole("button", { name: "为material_bom选择唯一标识" }).click();
  const dialog = page.getByRole("dialog");
  // Ant Design hides the checkbox input under its own box, so the click goes to the label.
  await dialog.getByText("material_code", { exact: true }).click();
  await expect(dialog.getByRole("checkbox", { name: /^material_code/ })).toBeChecked();
  await dialog.getByRole("button", { name: /保\s*存/ }).click();
  await expect(dialog).toBeHidden();

  await expect(adopt).toBeEnabled();
  await adopt.click();
  await expect(adopt).toBeChecked();

  await page.getByText(/^本次变更 2/).click();
  const changes = page.getByTestId("draft-change");
  await expect(changes).toHaveCount(2);
  // Newest first: the adoption, then the identity it needed.
  await expect(changes.nth(0)).toContainText("material_bom");
  await expect(changes.nth(1)).toContainText("material_code");

  expect(pageErrors).toEqual([]);
});
