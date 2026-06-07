import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { assertBackendReady, apiUrl } from "../../helpers/common";
import { cloneOperatorImpexForCreate, buildImpexImportName } from "../../helpers/impex";
import {
  buildOperatorName,
  cleanupOperatorViaApi,
  exportOperatorViaApi,
  registerOperatorViaApi,
  type RegisteredOperator,
} from "../../helpers/operator";

function operatorCard(page: import("@playwright/test").Page, operatorName: string) {
  return page
    .locator(".ant-card")
    .filter({ has: page.getByRole("heading", { level: 5, name: operatorName }) })
    .first();
}

test.describe("Execution Factory — Impex UI E2E flows", () => {
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
      if (!operator) continue;
      try {
        await cleanupOperatorViaApi(request, operator);
      } catch (error) {
        console.warn(String(error));
      }
    }
  });

  test.beforeEach(() => {
    test.skip(!backendReady, "execution-factory backend is not running on :9000");
  });

  test("IMPEX-UI-01: import operator ADP package through UI", async ({ page, request }) => {
    const source = await registerOperatorViaApi(request, buildOperatorName("ui_impex_src"));
    createdOperators.push(source);

    const exported = (await exportOperatorViaApi(request, source.operatorId)) as Record<
      string,
      unknown
    >;
    const importName = buildImpexImportName("at_e2e_ui_impex");
    const payload = cloneOperatorImpexForCreate(exported, importName);
    const filePath = join(tmpdir(), `e2e-operator-${Date.now()}.json`);
    writeFileSync(filePath, JSON.stringify(payload), "utf8");

    await page.goto("/execution-factory/units?activeTab=operator");
    await page.getByRole("button", { name: /导入/ }).click();
    await page.getByRole("tab", { name: "ADP 包" }).click();
    const importDialog = page.getByRole("dialog");
    await importDialog
      .getByRole("tabpanel", { name: "ADP 包" })
      .locator('input[type="file"]')
      .setInputFiles(filePath);
    await importDialog.getByRole("button", { name: "开始导入" }).click();

    await expect(page.getByText(/成功|success/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 5, name: importName })).toBeVisible();

    const list = await request.get(apiUrl("/operator/info/list?page=1&page_size=50"), {
      headers: { "x-business-domain": "bd_public" },
    });
    if (list.ok()) {
      const body = (await list.json()) as {
        data?: Array<{ operator_id: string; name?: string; version: string }>;
      };
      const imported = body.data?.find((item) => item.name === importName);
      if (imported) {
        createdOperators.push({
          operatorId: imported.operator_id,
          version: imported.version,
          name: importName,
        });
      }
    }
  });

  test("IMPEX-UI-02: export operator ADP from card menu", async ({ page, request }) => {
    const operator = await registerOperatorViaApi(request, buildOperatorName("ui_export"));
    createdOperators.push(operator);

    await page.goto("/execution-factory/units?activeTab=operator");
    const card = operatorCard(page, operator.name);
    await card.getByRole("button", { name: "更多操作" }).click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: "导出" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.adp$/i);
  });
});
