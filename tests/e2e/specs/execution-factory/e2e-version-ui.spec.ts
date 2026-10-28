/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, test } from "@playwright/test";

import { assertBackendReady } from "../../helpers/common";
import {
  gotoE2ePage,
  gotoUnitsTab,
  openCatalogInstallDialog,
  openSkillReleaseHistoryDrawer,
  retryListLoadIfNeeded,
  searchExecutionUnitByName,
  waitForImpexExportResponse,
  waitForImpexImportResponse,
  expectAppToast,
} from "../../helpers/execution-unit-ui";
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
