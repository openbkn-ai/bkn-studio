import { expect, test } from "@playwright/test";

import { apiUrl, assertBackendReady } from "../../helpers/common";
import {
  buildToolboxName,
  cleanupToolboxViaApi,
  createToolViaApi,
  createToolboxViaApi,
  exportToolboxViaApi,
  importOpenApiToolsBatchViaApi,
  importToolboxViaApi,
  publishToolboxViaApi,
  type ToolboxRecord,
} from "../../helpers/toolbox";

test.describe("Execution Factory — Toolbox E2E flows", () => {
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

  test("TB-01: create toolbox with OpenAPI metadata", async ({ request }) => {
    const name = buildToolboxName("create");
    const toolbox = await createToolboxViaApi(request, name);
    createdBoxIds.push(toolbox.boxId);

    const detail = await request.get(apiUrl(`/tool-box/${toolbox.boxId}`), {
      headers: { "x-business-domain": "bd_public" },
    });
    expect(detail.ok()).toBeTruthy();
  });

  test("TB-02: add tool to toolbox", async ({ request }) => {
    const toolbox = await createToolboxViaApi(request, buildToolboxName("tool"));
    createdBoxIds.push(toolbox.boxId);

    const tool = await createToolViaApi(request, toolbox.boxId, buildToolboxName("inner_tool"));
    expect(tool.toolId).toBeTruthy();

    const list = await request.get(
      apiUrl(`/tool-box/${toolbox.boxId}/tools/list?page=1&page_size=20`),
      { headers: { "x-business-domain": "bd_public" } },
    );
    expect(list.ok()).toBeTruthy();
    const body = (await list.json()) as {
      data?: Array<{ tool_id: string }>;
      items?: Array<{ tool_id: string }>;
      tools?: Array<{ tool_id: string }>;
    };
    const tools = body.tools ?? body.data ?? body.items ?? [];
    expect(tools.some((item) => item.tool_id === tool.toolId)).toBeTruthy();
  });

  test("TB-03: publish toolbox and verify market", async ({ request }) => {
    const toolbox = await createToolboxViaApi(request, buildToolboxName("publish"));
    createdBoxIds.push(toolbox.boxId);

    await publishToolboxViaApi(request, toolbox.boxId);

    const market = await request.get(apiUrl("/tool-box/market?page=1&page_size=20"), {
      headers: { "x-business-domain": "bd_public" },
    });
    expect(market.ok()).toBeTruthy();
    const body = (await market.json()) as { data?: Array<{ box_id: string }> };
    expect(body.data?.some((item) => item.box_id === toolbox.boxId)).toBeTruthy();
  });

  test("TB-04: impex export then import copy", async ({ request }) => {
    const toolbox = await createToolboxViaApi(request, buildToolboxName("impex"));
    createdBoxIds.push(toolbox.boxId);

    const exported = await exportToolboxViaApi(request, toolbox.boxId);
    expect(exported).toBeTruthy();
    await importToolboxViaApi(request, exported, "upsert");
  });

  test("TB-05: batch import multiple tools from OpenAPI spec", async ({ request }) => {
    const toolbox = await createToolboxViaApi(request, buildToolboxName("batch_tools"));
    createdBoxIds.push(toolbox.boxId);

    const result = await importOpenApiToolsBatchViaApi(
      request,
      toolbox.boxId,
      buildToolboxName("batch"),
    );
    expect(result.successCount).toBeGreaterThanOrEqual(2);
    expect(result.toolIds.length).toBeGreaterThanOrEqual(2);
  });
});
