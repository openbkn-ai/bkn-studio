/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, test, type Page } from "@playwright/test";

import { expectNoForbiddenWords } from "../../helpers/forbidden-words";

// Run against a local Studio dev server in mock mode (VITE_USE_MOCK=true). Without
// VITE_MOCK_EDITION the mock is the community image: no extension installed, so no page of a
// project may show professional-edition wording or a knowledge-base entry.
const LOCALES = [
  {
    locale: "zh-CN",
    sections: ["项目概览", "需求场景", "本体建模", "确认与发布"],
    documents: /^输入资料 \d+$/,
  },
  {
    locale: "en-US",
    sections: ["Overview", "Requirements", "Ontology modeling", "Confirm and release"],
    documents: /^Documents \d+$/,
  },
] as const;

// Requirements and ontology modeling switch between views; the other sections have none.
const SECTIONS_WITH_VIEWS = [1, 2];

async function openSection(page: Page, name: string) {
  const item = page.getByRole("navigation").getByRole("button", { name, exact: true });
  await item.click();
  // The page has no heading of its own: the navigation marks it as the current one.
  await expect(item).toHaveAttribute("aria-current", "page");
}

/** Scans the section, then each of its views in turn. */
async function scanSection(page: Page, name: string, hasViews: boolean) {
  const views = page.locator('[role="tab"], .ant-segmented-item');
  if (hasViews) {
    await expect(views.first()).toBeVisible();
  }
  await expectNoForbiddenWords(page, `section ${name}`);
  for (let index = 0; index < (await views.count()); index += 1) {
    const view = views.nth(index);
    const label = (await view.innerText()).trim();
    await view.click();
    await expectNoForbiddenWords(page, `section ${name}, view ${label}`);
  }
}

async function closeDialog(page: Page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /取\s*消|Cancel/ })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

for (const { locale, sections, documents } of LOCALES) {
  test(`bkn project (${locale}): the community image shows no professional wording`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.addInitScript((value) => localStorage.setItem("bkn-studio:locale", value), locale);

    await page.goto("/studio/bkn-project");
    await expect(page.getByText("Delivery Delay Warning").first()).toBeVisible();
    await expectNoForbiddenWords(page, "project list");

    await page.getByRole("button", { name: /新建项目|New project/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoForbiddenWords(page, "new project dialog");
    await closeDialog(page);

    await page.getByText("Delivery Delay Warning").first().click();
    const nav = page.getByRole("navigation", { name: /项目导航|Project navigation/ });
    await expect(nav).toBeVisible();
    // The knowledge-base build section belongs to the extension; the community image has none.
    await expect(nav.getByRole("button")).toHaveCount(sections.length);
    for (const [index, section] of sections.entries()) {
      await openSection(page, section);
      await scanSection(page, section, SECTIONS_WITH_VIEWS.includes(index));
    }

    // Uploading accepts Markdown and plain text only; PDF / DOCX belong to the extension.
    await openSection(page, sections[1]);
    await page.getByText(documents).click();
    await page.getByRole("button", { name: /上传文档|Upload documents/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoForbiddenWords(page, "upload dialog");
    await closeDialog(page);

    expect(pageErrors).toEqual([]);
  });
}
