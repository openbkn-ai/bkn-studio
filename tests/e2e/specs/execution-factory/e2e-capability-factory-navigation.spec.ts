/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, test } from "@playwright/test";

import { gotoE2ePage } from "../../helpers/execution-unit-ui";

test.describe("Capability Factory navigation", () => {
  test("user can discover management, market, and sandbox runtime from the official entry", async ({
    page,
  }) => {
    const sandboxRequests: string[] = [];
    const configRequests: string[] = [];

    page.on("request", (request) => {
      if (request.url().includes("config.js")) {
        configRequests.push(request.url());
      }
    });

    await page.route(
      "**/api/agent-operator-integration/internal-v1/sandbox/health",
      async (route) => {
        sandboxRequests.push(route.request().url());
        await route.fulfill({
          contentType: "application/json",
          json: {
            status: "healthy",
            control_plane_reachable: true,
            max_sessions: 4,
            current_active_sessions: 1,
            current_running_tasks: 0,
            failed_sessions: 0,
            checked_at: "2026-07-02T10:00:00Z",
          },
        });
      },
    );
    await page.route(
      "**/api/agent-operator-integration/internal-v1/sandbox/pool",
      async (route) => {
        sandboxRequests.push(route.request().url());
        await route.fulfill({
          contentType: "application/json",
          json: {
            max_sessions: 4,
            active_sessions: 1,
            max_concurrent_tasks: 2,
            current_active_sessions: 1,
            current_running_tasks: 0,
            template_id: "python-basic",
          },
        });
      },
    );
    await page.route(
      "**/api/agent-operator-integration/internal-v1/sandbox/sessions**",
      async (route) => {
        sandboxRequests.push(route.request().url());
        await route.fulfill({
          contentType: "application/json",
          json: {
            items: [],
            total: 0,
            limit: 20,
            offset: 0,
            has_more: false,
          },
        });
      },
    );

    await gotoE2ePage(page, "/studio/execution-factory/units");

    await expect(page.getByText(/能力工厂|Capability Factory/i).first()).toBeVisible();
    await expect(page.getByText(/能力管理|Capability Management/i).first()).toBeVisible();
    await expect(page.getByText(/能力市场|Capability Market/i).first()).toBeVisible();
    await expect(page.getByText(/沙箱运行时管理|Sandbox Runtime/i).first()).toBeVisible();
    await expect(page.getByText(/执行工厂（实验版）|Execution Factory \(Lab\)/i)).toHaveCount(0);

    await page.getByText(/沙箱运行时管理|Sandbox Runtime/i).first().click();
    await expect(page).toHaveURL(/\/studio\/execution-factory\/sandbox-runtime/);
    await expect(page.getByText(/沙箱运行时管理|Sandbox Runtime/i).first()).toBeVisible();
    await expect(page.getByText(/加载沙箱运行时数据失败|Failed to load sandbox runtime/i)).toHaveCount(0);
    await expect(page.getByText("healthy").first()).toBeVisible();
    expect(sandboxRequests.length).toBeGreaterThanOrEqual(3);
    expect(sandboxRequests.every((url) => !url.includes("/api/api/"))).toBe(true);
    expect(configRequests.some((url) => url.endsWith("/studio/config.js"))).toBe(true);
    expect(configRequests.every((url) => !url.includes("/studio/studio/config.js"))).toBe(true);
  });
});
