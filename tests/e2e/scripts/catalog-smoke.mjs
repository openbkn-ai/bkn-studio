/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];

page.on("pageerror", (error) => errors.push(String(error)));
page.on("console", (message) => {
  if (message.type() === "error") {
    errors.push(message.text());
  }
});

await page.goto("http://host.docker.internal:5173/execution-factory/catalog", {
  waitUntil: "networkidle",
  timeout: 60_000,
});
await page.waitForTimeout(3000);

const tab = await page.locator(".ant-tabs-tab-active").innerText().catch(() => "none");
const hasTable = await page.locator(".ant-table").count();
const cardGrid = await page.locator('[class*="cardGrid"]').count();
const cardBody = await page.locator('[class*="cardBody"]').count();
const bodyText = await page.locator("body").innerText();
const hasToolbox = bodyText.includes("OpenBKN_Test_Toolbox");

console.log(
  JSON.stringify(
    {
      tab,
      hasTable,
      cardGrid,
      cardBody,
      hasToolbox,
      errors: errors.slice(0, 8),
    },
    null,
    2,
  ),
);

await browser.close();
