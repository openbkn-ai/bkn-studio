/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const LOG_PATH = resolve("/repo/debug-f2a625.log");
const BASE = "http://host.docker.internal:5173";

function writeLog(payload) {
  appendFileSync(LOG_PATH, `${JSON.stringify(payload)}\n`, "utf8");
}

const browser = await chromium.launch();
const page = await browser.newPage();

const checks = [];

async function checkRedirect(path, expect) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(1500);

  const url = page.url();
  const hasTable = (await page.locator(".ant-table").count()) > 0;
  const hasCardGrid = (await page.locator('[class*="cardGrid"]').count()) > 0;
  const primaryButtons = await page.locator("button.ant-btn-primary").allInnerTexts();
  const drawerOpen = (await page.locator(".ant-drawer-open").count()) > 0;
  const modalOpen = (await page.locator(".ant-modal").count()) > 0;

  checks.push({
    path,
    url,
    hasTable,
    hasCardGrid,
    primaryButtons,
    drawerOpen,
    modalOpen,
    ...expect(url, primaryButtons, { drawerOpen, modalOpen, hasTable, hasCardGrid }),
  });
}

await checkRedirect("/execution-factory/mcp", (url, buttons, ui) => ({
  redirectedToUnits: url.includes("/execution-factory/units") && url.includes("activeTab=mcp"),
  hasMcpCreateButton: buttons.some((text) => /新建 MCP|New MCP/i.test(text)),
  usesOldTableUi: ui.hasTable && !ui.hasCardGrid,
}));

await checkRedirect("/execution-factory/mcp/new", (url, buttons, ui) => ({
  redirectedToUnits: url.includes("/execution-factory/units") && url.includes("activeTab=mcp"),
  autoOpenedDrawer: ui.drawerOpen,
  usesOldFormPage: buttons.some((text) => /^(创建|Create)$/.test(text.trim())),
}));

await checkRedirect("/execution-factory/skills/new", (url, _buttons, ui) => ({
  redirectedToUnits: url.includes("/execution-factory/units") && url.includes("activeTab=skill"),
  autoOpenedModal: ui.modalOpen,
}));

writeLog({
  sessionId: "f2a625",
  runId: "redirect-smoke",
  hypothesisId: "G",
  location: "create-menu-redirect-smoke.mjs",
  message: "Legacy MCP/Skill routes redirect to CreateMenu",
  data: { checks },
  timestamp: Date.now(),
});

console.log(JSON.stringify({ checks }, null, 2));

await browser.close();
