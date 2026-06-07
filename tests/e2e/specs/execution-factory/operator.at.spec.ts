import { expect, test } from "@playwright/test";

import {
  assertBackendReady,
  buildMinimalOpenApiSpec,
  buildOperatorName,
  cleanupOperatorViaApi,
  publishOperatorViaApi,
  registerOperatorViaApi,
  type RegisteredOperator,
} from "../../helpers/operator";

function operatorCard(page: import("@playwright/test").Page, operatorName: string) {
  return page
    .locator(".ant-card")
    .filter({ has: page.getByRole("heading", { level: 5, name: operatorName }) })
    .first();
}

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
    await page.goto("/execution-factory/units?activeTab=operator");

    await expect(page.getByText("执行单元管理").first()).toBeVisible();
    await expect(page.getByRole("tab", { name: "算子" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "工具" })).toBeVisible();
    await expect(page.getByRole("button", { name: /新建算子/ })).toBeVisible();
  });

  test("AT-02: register operator through UI and verify in list", async ({ page }) => {
    const operatorName = buildOperatorName(String(Date.now()));
    const openApiSpec = JSON.stringify(buildMinimalOpenApiSpec(operatorName), null, 2);

    await page.goto("/execution-factory/units/new");

    await expect(page.getByRole("heading", { name: "注册算子" })).toBeVisible();
    await page.getByLabel("算子名称").fill(operatorName);
    await page.getByLabel("描述").fill("Playwright AT — UI registration flow");
    await page.getByLabel("OpenAPI 规范").fill(openApiSpec);
    await page.getByRole("button", { name: /保\s*存/ }).click();

    await expect(page).toHaveURL(/\/execution-factory\/units/);
    await page.getByRole("tab", { name: "算子" }).click();
    await expect(page.getByRole("heading", { level: 5, name: operatorName })).toBeVisible();

    const card = operatorCard(page, operatorName);
    await expect(card.locator(".ant-tag").filter({ hasText: "未发布" })).toBeVisible();

    await card.getByRole("button", { name: "更多操作" }).click();
    await page.getByRole("menuitem", { name: "查看" }).click();
    await expect(page.getByText("算子详情")).toBeVisible();
    await expect(page.getByText(operatorName).first()).toBeVisible();

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

    await page.goto("/execution-factory/units?activeTab=operator");
    await expect(page.getByRole("heading", { level: 5, name: operatorName })).toBeVisible();

    const card = operatorCard(page, operatorName);
    await expect(card.locator(".ant-tag").filter({ hasText: "已发布" })).toBeVisible();
  });
});
