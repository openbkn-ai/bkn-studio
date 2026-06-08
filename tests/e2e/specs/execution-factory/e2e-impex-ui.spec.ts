import { writeFileSync } from "node:fs";

import { tmpdir } from "node:os";

import { join } from "node:path";



import { expect, test } from "@playwright/test";



import { assertBackendReady, apiUrl } from "../../helpers/common";

import { cloneOperatorImpexForCreate, buildImpexImportName } from "../../helpers/impex";

import {

  expectAppToast,

  exportFromCardMenu,

  gotoUnitsTab,

  openImportModal,

  uploadAdpPackageInImportDialog,

  waitForImpexImportResponse,

} from "../../helpers/execution-unit-ui";

import {

  buildOperatorName,

  cleanupOperatorViaApi,

  exportOperatorViaApi,

  registerOperatorViaApi,

  type RegisteredOperator,

} from "../../helpers/operator";

import {

  buildToolboxName,

  cleanupToolboxViaApi,

  createToolboxViaApi,

} from "../../helpers/toolbox";



test.describe("Execution Factory — Impex UI E2E flows", () => {
  test.describe.configure({ timeout: 180_000 });

  let backendReady = false;

  const createdOperators: RegisteredOperator[] = [];

  const createdBoxIds: string[] = [];



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



  test("IMPEX-UI-01: import operator ADP package through UI", async ({ page, request }) => {

    const source = await registerOperatorViaApi(request, buildOperatorName("ui_impex_src"));

    createdOperators.push(source);



    const exported = (await exportOperatorViaApi(request, source.operatorId)) as Record<

      string,

      unknown

    >;

    const importName = buildImpexImportName("at_e2e_ui_impex");

    const payload = cloneOperatorImpexForCreate(exported, importName);

    const filePath = join(tmpdir(), `e2e-operator-${Date.now()}.adp`);

    writeFileSync(filePath, JSON.stringify(payload), "utf8");



    await gotoUnitsTab(page, "operator");

    const importDialog = await openImportModal(page);

    await uploadAdpPackageInImportDialog(importDialog, filePath);



    const importResponsePromise = waitForImpexImportResponse(page, "operator");
    await Promise.all([
      importResponsePromise,
      importDialog.getByRole("button", { name: /开始导入|Start import/i }).click(),
    ]);
    const importResponse = await importResponsePromise;

    expect(importResponse.ok()).toBeTruthy();



    await expectAppToast(page, /导入成功|Imported successfully/i);

    await expect(page.getByRole("dialog")).toBeHidden();

    const list = await request.get(apiUrl("/operator/info/list?page=1&page_size=50"), {

      headers: { "x-business-domain": "bd_public" },

    });

    if (list.ok()) {

      const body = (await list.json()) as {

        data?: Array<{ operator_id: string; name?: string; version: string }>;

      };

      const imported = body.data?.find((item) => item.name === importName);

      expect(imported).toBeTruthy();

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



    await gotoUnitsTab(page, "operator");

    await exportFromCardMenu(page, operator.name, "operator");

  });



  test("IMPEX-UI-03: export toolbox ADP from card menu", async ({ page, request }) => {

    const toolbox = await createToolboxViaApi(request, buildToolboxName("ui_export"));

    createdBoxIds.push(toolbox.boxId);



    await gotoUnitsTab(page, "toolbox");

    await exportFromCardMenu(page, toolbox.name, "toolbox");

  });

});


