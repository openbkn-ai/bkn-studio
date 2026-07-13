/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, test } from "@playwright/test";

import {
  executionUnitCard,
  expectCapabilityManagementPage,
  expectOpenApiOperationsIoPreview,
  fillOpenApiSpecPaste,
  gotoE2ePage,
  openAdvancedOperatorTab,
  openCreateWizard,
  openOperatorCreateForm,
  OPERATOR_TAB_LABEL,
} from "../../helpers/execution-unit-ui";
import {
  assertBackendReady,
  buildMinimalOpenApiSpec,
  buildOperatorName,
  cleanupOperatorViaApi,
  publishOperatorViaApi,
  registerOperatorViaApi,
  type RegisteredOperator,
} from "../../helpers/operator";

test.describe("Execution Factory — Operator AT", () => {
  let backendReady = false;
  const createdOperators: RegisteredOperator[] = [];

  test.beforeAll(async ({ request }) => {
    try {
      await assertBackendReady(request);
      backendReady = true;
    } catch (error) {
      backendReady = false;
      console.warn(String(error));
    }
  });

  test.afterEach(async ({ request }) => {
    while (createdOperators.length > 0) {
      const operator = createdOperators.pop();
      if (!operator) {
        continue;
      }

      try {
        await cleanupOperatorViaApi(request, operator);
      } catch (error) {
        console.warn(`Cleanup failed for ${operator.operatorId}: ${String(error)}`);
      }
    }
  });

  test.beforeEach(() => {
    test.skip(!backendReady, "execution-factory backend is not running on :9000");
  });

  test("AT-01: operator list page loads and shows operators tab", async ({ page }) => {
    await openAdvancedOperatorTab(page);

    await expectCapabilityManagementPage(page);
    await expect(page.getByRole("tab", { name: OPERATOR_TAB_LABEL })).toBeVisible();
    await expect(page.getByRole("button", { name: /新建算子|New Operator/i })).toBeVisible();

    const drawer = await openCreateWizard(page, "operator");
    await expect(drawer.getByText(/选择类型|Select type/i).first()).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("AT-02: create operator through UI wizard and verify in list", async ({ page }) => {
    const operatorName = buildOperatorName(String(Date.now()));
    const openApiSpec = JSON.stringify(buildMinimalOpenApiSpec(operatorName), null, 2);

    await openOperatorCreateForm(page, "openapi");

    await page.getByLabel(/算子名称|Operator Name/i).fill(operatorName);
    await page.getByLabel(/描述|Description/i).fill("Playwright AT — UI registration flow");
    await fillOpenApiSpecPaste(page, openApiSpec);
    await expectOpenApiOperationsIoPreview(page, { containsText: /input|Input/i });
    await page.getByRole("button", { name: /保\s*存|Save/i }).click();

    await expect(page).toHaveURL(/\/execution-factory\/units\?activeTab=operator/);

    const detailDrawer = page.locator(".ant-drawer").first();
    await expect(detailDrawer.getByText(/算子详情|Operator Detail/i)).toBeVisible();
    await expect(detailDrawer.getByText(operatorName).first()).toBeVisible();

    await detailDrawer.getByRole("button", { name: /Close|关闭/i }).click();
    await expect(detailDrawer).toBeHidden();

    const card = executionUnitCard(page, operatorName);
    await expect(card).toBeVisible();
    await expect(card.locator(".ant-tag").filter({ hasText: /未发布|Unpublished/i })).toBeVisible();

    const listResponse = await page.request.get(
      "/api/agent-operator-integration/v1/operator/info/list?page=1&page_size=20",
      { headers: { "x-business-domain": "bd_public" } },
    );
    expect(listResponse.ok()).toBeTruthy();

    const listBody = (await listResponse.json()) as {
      data?: Array<{ operator_id: string; name?: string; version: string }>;
    };
    const matched = listBody.data?.find((item) => item.name === operatorName);
    expect(matched?.operator_id).toBeTruthy();

    createdOperators.push({
      operatorId: matched!.operator_id,
      version: matched!.version,
      name: operatorName,
    });
  });

  test("AT-03: register via API, publish, and verify published status in UI", async ({
    page,
    request,
  }) => {
    const operatorName = buildOperatorName(String(Date.now()));
    const operator = await registerOperatorViaApi(request, operatorName);
    createdOperators.push(operator);

    await publishOperatorViaApi(request, operator);

    await gotoE2ePage(page, "/execution-factory/units?activeTab=operator");
    await expect(page.getByRole("heading", { level: 5, name: operator.name })).toBeVisible();

    const card = executionUnitCard(page, operatorName);
    await expect(card.locator(".ant-tag").filter({ hasText: /已发布|Published/i })).toBeVisible();
  });
});
