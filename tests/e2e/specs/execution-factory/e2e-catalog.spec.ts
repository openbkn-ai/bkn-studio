import { expect, test } from "@playwright/test";

import { apiUrl, assertBackendReady } from "../../helpers/common";
import { cloneToolboxImpexForCreate } from "../../helpers/impex";
import {
  buildToolboxName,
  cleanupToolboxViaApi,
  createToolboxViaApi,
  exportToolboxViaApi,
  importToolboxViaApi,
  publishToolboxViaApi,
} from "../../helpers/toolbox";
import { gotoE2ePage } from "../../helpers/execution-unit-ui";

test.describe("Execution Factory — Catalog E2E flows", () => {
  let backendReady = false;
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
    while (createdBoxIds.length > 0) {
      const boxId = createdBoxIds.pop();
      if (!boxId) continue;
      try {
        await cleanupToolboxViaApi(request, boxId);
      } catch (error) {
        console.warn(`Cleanup failed for toolbox ${boxId}: ${String(error)}`);
      }
    }
  });

  test.beforeEach(() => {
    test.skip(!backendReady, "execution-factory backend is not running on :9000");
  });

  test("CAT-01: catalog install toolbox via impex export/import", async ({ request }) => {
    const toolbox = await createToolboxViaApi(request, buildToolboxName("catalog"));
    createdBoxIds.push(toolbox.boxId);
    await publishToolboxViaApi(request, toolbox.boxId);

    const exported = await exportToolboxViaApi(request, toolbox.boxId);
    const importResponse = await request.post(apiUrl("/impex/import/toolbox"), {
      headers: { "x-business-domain": "bd_public" },
      multipart: {
          mode: "upsert",
          data: {
            name: "catalog-install.adp.json",
            mimeType: "application/json",
            buffer: Buffer.from(JSON.stringify(exported)),
          },
        },
      },
    );
    expect(importResponse.ok()).toBeTruthy();
  });

  test("CAT-03: catalog install toolbox via impex create mode", async ({ request }) => {
    const toolbox = await createToolboxViaApi(request, buildToolboxName("catalog_create"));
    createdBoxIds.push(toolbox.boxId);
    await publishToolboxViaApi(request, toolbox.boxId);

    const exported = await exportToolboxViaApi(request, toolbox.boxId);
    const importName = buildToolboxName("catalog_installed");
    const payload = cloneToolboxImpexForCreate(exported as Record<string, unknown>, importName);

    await importToolboxViaApi(request, payload, "create");

    const newBoxId = (payload.toolbox as { configs?: Array<{ box_id?: string }> })?.configs?.[0]
      ?.box_id;
    expect(newBoxId).toBeTruthy();
    if (newBoxId) {
      createdBoxIds.push(newBoxId);
    }
  });

  test("CAT-02: catalog page lists published toolbox", async ({ page, request }) => {
    const toolbox = await createToolboxViaApi(request, buildToolboxName("catalog_ui"));
    createdBoxIds.push(toolbox.boxId);
    await publishToolboxViaApi(request, toolbox.boxId);

    await gotoE2ePage(page, "/execution-factory/catalog?activeTab=toolbox");
    await expect(page.getByText(toolbox.name).first()).toBeVisible({ timeout: 30_000 });
  });
});
