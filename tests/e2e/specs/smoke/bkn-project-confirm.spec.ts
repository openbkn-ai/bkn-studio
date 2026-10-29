/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, test } from "@playwright/test";

// Run against a local Studio dev server in mock mode (VITE_USE_MOCK=true). The mock keeps the
// draft and its confirmation in memory, so the flow stays on one page load.
test("bkn project: understand the data, confirm the draft, and see its check and indexes", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("bkn-studio:locale", "zh-CN"));

  await page.goto("/studio/bkn-project");
  await page.getByText("Delivery Delay Warning").first().click();
  await page.getByRole("button", { name: "本体建模", exact: true }).click();

  // Semantic understanding names the tables drafting reads; it runs one table at a time.
  await expect(page.getByText("还没有运行过语义理解")).toBeVisible();
  await page.getByRole("button", { name: "语义理解", exact: true }).click();
  const understand = page.getByRole("dialog");
  await understand.getByRole("button", { name: /开\s*始/ }).click();
  await expect(understand).toBeHidden();
  await expect(page.getByText(/^语义理解：已完成 \d \/ 3 张表$/)).toBeVisible();

  // An adopted relation waits for the object type at its end, so confirming waits too.
  const confirm = page.getByRole("button", { name: "确认草稿" });
  await expect(confirm).toBeDisabled();
  await page.getByRole("button", { name: "为material_bom选择唯一标识" }).click();
  const identity = page.getByRole("dialog");
  await identity.getByText("material_code", { exact: true }).click();
  await identity.getByRole("button", { name: /保\s*存/ }).click();
  await expect(identity).toBeHidden();
  await page.getByRole("switch", { name: "采纳material_bom" }).click();
  await expect(confirm).toBeEnabled();

  // A table drafting could not read has to be accepted before confirming.
  await confirm.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("audit_log")).toBeVisible();
  const ok = dialog.getByRole("button", { name: /^确\s*认$/ });
  await expect(ok).toBeDisabled();
  await dialog.getByText("知道这些表没有参与起草，仍然确认").click();
  await ok.click();

  // Confirming leads to the release page, where the check and the builds run in the background.
  await expect(page).toHaveURL(/\/bkn-project\/p-001\/release$/);
  await expect(page.getByText(/^已于 .+ 确认$/)).toBeVisible();
  const check = page.getByRole("region", { name: "数据校验" });
  await expect(check.getByText(/^已核对 \d+ \/ \d+ 项$/)).toBeVisible();
  const indexes = page.getByRole("region", { name: "本地索引" });
  await expect(indexes.getByText("缺少构建设置")).toBeVisible();
  await expect(indexes.getByText("可用").first()).toBeVisible();
  await expect(
    indexes.getByText("没有可用的更新字段，可以在本体建模中为对象类指定。"),
  ).toBeVisible();

  expect(pageErrors).toEqual([]);
});
