/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, test, type Locator } from "@playwright/test";

const translations = [
  {
    language: "zh-CN",
    scope: "待测配置",
    removedTarget: "验证范围",
    configurations: ["当前配置（未保存）", "Catalog 已保存配置"],
    configurationHints: [/执行一次登录并校验响应和成功条件/, /仅检查 TCP\/TLS 连通性/],
    resourceHint: /业务响应与字段映射/,
    run: "开始测试",
    close: "关闭",
  },
  {
    language: "en-US",
    scope: "Configuration to test",
    removedTarget: "Validation scope",
    configurations: ["Current configuration (unsaved)", "Saved catalog configuration"],
    configurationHints: [
      /runs one login and validates its response/,
      /checks TCP\/TLS reachability only/,
    ],
    resourceHint: /Validate business responses and field mappings/,
    run: "Run test",
    close: "Close",
  },
];

async function fieldGeometry(control: Locator) {
  return control.evaluate((input) => {
    const field = input.closest("label")!;
    const label = field.querySelector("span")!.getBoundingClientRect();
    const select = input.closest(".ant-select")!.getBoundingClientRect();
    return {
      labelBottom: label.bottom,
      x: select.x,
      y: select.y,
      width: select.width,
      height: select.height,
    };
  });
}

for (const copy of translations) {
  for (const width of [1280, 640, 360]) {
    test(`${copy.language} keeps the unified connection test usable at ${width}px`, async ({
      page,
    }, testInfo) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.route("**/src/main.tsx", (route) =>
        route.fulfill({
          contentType: "application/javascript",
          body: 'import "/studio/tests/e2e/fixtures/api-connection-test.tsx";',
        }),
      );
      // Keep this production-component fixture isolated from real backend requests.
      await page.route("**/api/**", (route) =>
        route.fulfill({ json: { entries: [], total_count: 0 } }),
      );
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/studio/?language=${copy.language}`);
      const dialog = page.getByRole("dialog");
      const scope = dialog.getByRole("combobox", { name: copy.scope, exact: true });
      await expect(scope).toBeVisible();
      await expect(dialog.getByText(copy.resourceHint)).toBeVisible();

      for (const [index, configuration] of copy.configurations.entries()) {
        await dialog.locator(".ant-select").click();
        await page
          .locator(".ant-select-dropdown:visible")
          .getByText(configuration, { exact: true })
          .click();
        await expect(dialog.getByRole("combobox")).toHaveCount(1);
        await expect(
          dialog.getByRole("combobox", { name: copy.removedTarget, exact: true }),
        ).toHaveCount(0);
        await expect(dialog.getByText(copy.configurationHints[index])).toBeVisible();
        await expect(dialog.getByText(copy.configurationHints[1 - index])).toHaveCount(0);
        const field = await fieldGeometry(scope);
        const dialogBox = await dialog.boundingBox();
        expect(dialogBox).not.toBeNull();
        expect(field.y).toBeGreaterThanOrEqual(field.labelBottom);
        expect(field.width).toBeGreaterThan(0);
        expect(field.height).toBeGreaterThan(0);
        expect(field.x).toBeGreaterThanOrEqual(dialogBox!.x);
        expect(field.x + field.width).toBeLessThanOrEqual(dialogBox!.x + dialogBox!.width);
        expect(
          await dialog.evaluate((element) => element.scrollWidth - element.clientWidth),
        ).toBeLessThanOrEqual(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
        await dialog.getByRole("button", { name: copy.run, exact: true }).click();
        await expect(page.getByLabel("Last test")).toHaveText(index === 0 ? "draft" : "saved");
      }
      await expect(
        dialog.locator(".ant-modal-footer").getByRole("button", { name: copy.close, exact: true }),
      ).toBeVisible();
      await expect(dialog.locator(".ant-modal-footer button").first()).toHaveText(copy.close);
      await expect(dialog.getByText("common.close", { exact: true })).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath(`${copy.language}-${width}.png`) });
      await dialog
        .locator(".ant-modal-footer")
        .getByRole("button", { name: copy.close, exact: true })
        .click();
      await expect(dialog).toHaveCount(0);
      expect(pageErrors).toEqual([]);
    });
  }
}
