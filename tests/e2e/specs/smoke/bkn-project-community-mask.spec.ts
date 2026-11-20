/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, test } from "@playwright/test";

// Run against a local Studio dev server in mock mode (VITE_USE_MOCK=true). Without
// VITE_MOCK_EDITION the mock is the community image: project management ships in the enterprise
// image, so the entry carries its edition label and every project path shows the upgrade card.
const LOCALES = [
  { locale: "zh-CN", entry: "项目管理", badge: "专业版", unlock: "解锁专业版能力" },
  {
    locale: "en-US",
    entry: "Project management",
    badge: "Pro",
    unlock: "Unlock Professional",
  },
] as const;

for (const { locale, entry, badge, unlock } of LOCALES) {
  test(`bkn project (${locale}): the community image masks project management`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.addInitScript((value) => localStorage.setItem("bkn-studio:locale", value), locale);

    await page.goto("/studio/home");
    const nav = page.getByRole("button", { name: new RegExp(`^${entry}`) }).first();
    await expect(nav).toBeVisible();
    await expect(nav.getByText(badge, { exact: true })).toBeVisible();

    for (const path of ["/studio/bkn-project", "/studio/bkn-project/p1/model"]) {
      await page.goto(path);
      await expect(page.getByText(unlock, { exact: true })).toBeVisible();
      // The preview stays behind the mask, out of reach.
      await expect(page.locator(".console-upgrade-locked-content")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
    }

    expect(pageErrors).toEqual([]);
  });
}
