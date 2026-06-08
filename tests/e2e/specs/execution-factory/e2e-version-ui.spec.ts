import { expect, test } from "@playwright/test";

import { assertBackendReady } from "../../helpers/common";
import {
  executionUnitCard,
  expectAppToast,
  gotoE2ePage,
  openCatalogInstallDialog,
  retryListLoadIfNeeded,
  searchExecutionUnitByName,
  waitForImpexExportResponse,
  waitForImpexImportResponse,
} from "../../helpers/execution-unit-ui";
import {
  buildOperatorName,
  cleanupOperatorViaApi,
  publishOperatorViaApi,
  registerOperatorViaApi,
  type RegisteredOperator,
} from "../../helpers/operator";
import {
  buildSkillName,
  cleanupSkillViaApi,
  publishSkillViaApi,
  registerSkillViaApi,
} from "../../helpers/skill";
import {
  buildToolboxName,
  cleanupToolboxViaApi,
  createToolboxViaApi,
  publishToolboxViaApi,
} from "../../helpers/toolbox";

function operatorCard(page: import("@playwright/test").Page, operatorName: string) {
  return executionUnitCard(page, operatorName);
}

test.describe("Execution Factory — Version & catalog UI E2E flows", () => {
  test.describe.configure({ timeout: 180_000 });

  let backendReady = false;
  const createdOperators: RegisteredOperator[] = [];
  const createdBoxIds: string[] = [];
  const createdSkillIds: string[] = [];

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
    while (createdSkillIds.length > 0) {
      const skillId = createdSkillIds.pop();
      if (!skillId) continue;
      try {
        await cleanupSkillViaApi(request, skillId);
      } catch (error) {
        console.warn(String(error));
      }
    }

    while (createdOperators.length > 0) {
      const operator = createdOperators.pop();
      if (!operator) continue;
      try {
        await cleanupOperatorViaApi(request, operator);
      } catch (error) {
        console.warn(String(error));
      }
    }

    while (createdBoxIds.length > 0) {
      const boxId = createdBoxIds.pop();
      if (!boxId) continue;
      try {
        await cleanupToolboxViaApi(request, boxId);
      } catch (error) {
        console.warn(String(error));
      }
    }
  });

  test.beforeEach(() => {
    test.skip(!backendReady, "execution-factory backend is not running on :9000");
  });

  test("VER-UI-01: operator version history drawer lists published version", async ({
    page,
    request,
  }) => {
    const operator = await registerOperatorViaApi(request, buildOperatorName("ui_hist"));
    createdOperators.push(operator);
    await publishOperatorViaApi(request, operator);

    await page.goto("/execution-factory/units?activeTab=operator");
    const card = operatorCard(page, operator.name);
    await card.getByRole("button", { name: "更多操作" }).click();
    await page.getByRole("menuitem", { name: "查看" }).click();
    await page.getByRole("button", { name: "版本历史" }).click();

    await expect(page.getByText(/算子版本历史/)).toBeVisible();
    await expect(page.locator(".ant-drawer").getByRole("cell").first()).toBeVisible();
  });

  test("VER-UI-02: skill release history drawer opens", async ({ page, request }) => {
    const skill = await registerSkillViaApi(
      request,
      `---\nname: ${buildSkillName("ui_hist")}\ndescription: ui history\n---\nBody`,
    );
    createdSkillIds.push(skill.skillId);
    await publishSkillViaApi(request, skill.skillId);

    await page.goto("/execution-factory/units?activeTab=skill");
    await page.getByRole("heading", { level: 5, name: skill.name }).click();
    await page.getByRole("button", { name: "发布历史" }).click();

    await expect(page.getByText("发布历史")).toBeVisible();
    await expect(page.locator(".ant-drawer").getByRole("cell").first()).toBeVisible();
  });

  test("CAT-UI-01: catalog install toolbox from market UI", async ({ page, request }) => {
    const toolbox = await createToolboxViaApi(request, buildToolboxName("ui_install"));
    createdBoxIds.push(toolbox.boxId);
    await publishToolboxViaApi(request, toolbox.boxId);

    await gotoE2ePage(page, "/execution-factory/catalog?activeTab=toolbox");
    await retryListLoadIfNeeded(page);
    const card = await searchExecutionUnitByName(page, toolbox.name);
    const installDialog = await openCatalogInstallDialog(page, card);
    await expect(installDialog).toBeVisible({ timeout: 30_000 });

    const exportResponsePromise = waitForImpexExportResponse(page, "toolbox");
    const importResponsePromise = waitForImpexImportResponse(page, "toolbox");
    await installDialog.getByRole("button", { name: /确认引入|开始同步|Confirm|Start/i }).click();

    const exportResponse = await exportResponsePromise;
    const importResponse = await importResponsePromise;
    expect(exportResponse.ok()).toBeTruthy();
    expect(importResponse.ok()).toBeTruthy();

    await expectAppToast(page, /同步成功|引入成功|Synced successfully|Introduced successfully/i);
    await expect(page.getByRole("dialog")).toBeHidden();
  });
});
