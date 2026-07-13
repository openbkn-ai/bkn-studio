/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { assertBackendReady } from "../../helpers/common";
import { cloneOperatorImpexForCreate, buildImpexImportName } from "../../helpers/impex";
import {
  exportFromCardMenu,
  gotoE2ePage,
  gotoUnitsTab,
  importBackupFileViaUi,
  openCatalogInstallDialog,
  openOperatorVersionHistoryDrawer,
  openSkillReleaseHistoryDrawer,
  retryListLoadIfNeeded,
  searchExecutionUnitByName,
  waitForImpexExportResponse,
  waitForImpexImportResponse,
  expectAppToast,
} from "../../helpers/execution-unit-ui";
import {
  buildOperatorName,
  cleanupOperatorViaApi,
  exportOperatorViaApi,
  listOperatorHistoryViaApi,
  publishOperatorViaApi,
  registerOperatorViaApi,
  updateOperatorViaApi,
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

    await gotoUnitsTab(page, "operator");
    const historyDrawer = await openOperatorVersionHistoryDrawer(page, operator.name);
    await expect(historyDrawer.getByRole("cell").first()).toBeVisible();
  });

  test("VER-UI-02: skill release history drawer opens", async ({ page, request }) => {
    const skill = await registerSkillViaApi(
      request,
      `---\nname: ${buildSkillName("ui_hist")}\ndescription: ui history\n---\nBody`,
    );
    createdSkillIds.push(skill.skillId);
    await publishSkillViaApi(request, skill.skillId);

    await gotoUnitsTab(page, "skill");
    const historyDrawer = await openSkillReleaseHistoryDrawer(page, skill.name);
    await expect(historyDrawer.getByRole("cell").first()).toBeVisible();
  });

  test("VER-UI-03: republish operator adds a second history entry", async ({ page, request }) => {
    const operator = await registerOperatorViaApi(request, buildOperatorName("ui_repub"));
    createdOperators.push(operator);
    await publishOperatorViaApi(request, operator);

    await updateOperatorViaApi(
      request,
      operator,
      operator.name,
      `Updated at ${Date.now()}`,
    );
    await publishOperatorViaApi(request, operator);

    const history = await listOperatorHistoryViaApi(request, operator.operatorId);
    expect(history.length).toBeGreaterThanOrEqual(2);

    await gotoUnitsTab(page, "operator");
    const historyDrawer = await openOperatorVersionHistoryDrawer(page, operator.name);
    await expect(historyDrawer.getByRole("cell").nth(1)).toBeVisible();
  });

  test("VER-UI-04: published operator backup export then UI import clone", async ({
    page,
    request,
  }) => {
    const operator = await registerOperatorViaApi(request, buildOperatorName("ui_ver_impex"));
    createdOperators.push(operator);
    await publishOperatorViaApi(request, operator);

    await gotoUnitsTab(page, "operator");
    await exportFromCardMenu(page, operator.name, "operator");

    const exported = (await exportOperatorViaApi(request, operator.operatorId)) as Record<
      string,
      unknown
    >;
    const importName = buildImpexImportName("ui_ver_impex_copy");
    const payload = cloneOperatorImpexForCreate(exported, importName);
    const filePath = join(tmpdir(), `e2e-ver-impex-${Date.now()}.adp`);
    writeFileSync(filePath, JSON.stringify(payload), "utf8");

    await importBackupFileViaUi(page, "operator", filePath);

    await expect(page.getByRole("heading", { level: 5, name: importName })).toBeVisible();
    const listResponse = await request.get(
      "/api/agent-operator-integration/v1/operator/info/list?page=1&page_size=50",
      { headers: { "x-business-domain": "bd_public" } },
    );
    if (listResponse.ok()) {
      const body = (await listResponse.json()) as {
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
