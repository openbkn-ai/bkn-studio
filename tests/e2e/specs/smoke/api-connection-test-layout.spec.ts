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
    target: "验证范围",
    configurations: ["当前配置（未保存）", "Catalog 已保存配置"],
    kinds: ["TCP / TLS 服务入口连通性", "本地表单校验", "显式登录验证", "所选 Resource 业务验证"],
    run: "开始测试",
    close: "关闭",
  },
  {
    language: "en-US",
    scope: "Configuration to test",
    target: "Validation scope",
    configurations: ["Current configuration (unsaved)", "Saved Catalog configuration"],
    kinds: [
      "TCP / TLS reachability",
      "Local form validation",
      "Explicit login validation",
      "Selected Resource business validation",
    ],
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

async function expectAlignedFields(scope: Locator, target: Locator, width: number) {
  const left = await fieldGeometry(scope);
  const right = await fieldGeometry(target);
  expect(left.y).toBeGreaterThanOrEqual(left.labelBottom);
  expect(right.y).toBeGreaterThanOrEqual(right.labelBottom);
  expect(Math.abs(left.height - right.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(left.width - right.width)).toBeLessThanOrEqual(1);
  if (width > 640) {
    expect(Math.abs(left.y - right.y)).toBeLessThanOrEqual(1);
    expect(right.x).toBeGreaterThan(left.x + left.width);
  } else {
    expect(Math.abs(left.x - right.x)).toBeLessThanOrEqual(1);
    expect(right.y).toBeGreaterThan(left.y + left.height);
  }
}

for (const copy of translations) {
  for (const width of [1280, 640, 360]) {
    test(`${copy.language} keeps configuration and validation controls aligned at ${width}px`, async ({
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
      // Resource selection may request metadata; never reach a real backend in this layout test.
      await page.route("**/api/**", (route) =>
        route.fulfill({ json: { entries: [], total_count: 0 } }),
      );
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/studio/?language=${copy.language}`);
      const dialog = page.getByRole("dialog");
      const scope = dialog.getByRole("combobox", { name: copy.scope, exact: true });
      const target = dialog.getByRole("combobox", { name: copy.target, exact: true });
      await expect(scope).toBeVisible();
      await expectAlignedFields(scope, target, width);

      for (const [index, configuration] of copy.configurations.entries()) {
        await dialog.locator(".ant-select").nth(0).click();
        await page
          .locator(".ant-select-dropdown:visible")
          .getByText(configuration, { exact: true })
          .click();
        for (const [kindIndex, kind] of copy.kinds.entries()) {
          if (index === 0 && kindIndex === 3) continue;
          await dialog.locator(".ant-select").nth(1).click();
          await page
            .locator(".ant-select-dropdown:visible")
            .getByText(kind, { exact: true })
            .click();
          await expectAlignedFields(scope, target, width);
          expect(
            await dialog.evaluate((element) => element.scrollWidth - element.clientWidth),
          ).toBeLessThanOrEqual(1);
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
          ).toBeLessThanOrEqual(width);
          if (kindIndex < 3) {
            await dialog.getByRole("button", { name: copy.run, exact: true }).click();
            await expect(page.getByLabel("Last test")).toHaveText(
              `${index === 0 ? "draft" : "saved"}:${["transport", "local", "login"][kindIndex]}`,
            );
          }
        }
      }
      await expect(
        dialog.locator(".ant-modal-footer").getByRole("button", { name: copy.close, exact: true }),
      ).toBeVisible();
      await expect(dialog.locator(".ant-modal-footer button").first()).toHaveText(copy.close);
      await expect(dialog.getByText("common.close", { exact: true })).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath(`${copy.language}-${width}.png`) });
      expect(pageErrors).toEqual([]);
    });
  }
}
