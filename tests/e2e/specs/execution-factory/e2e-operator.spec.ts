import { expect, test } from "@playwright/test";

import {
  apiUrl,
  assertBackendReady,
  buildOperatorName,
  cleanupOperatorViaApi,
  debugOperatorViaApi,
  exportOperatorViaApi,
  importOperatorViaApi,
  publishOperatorViaApi,
  registerOperatorViaApi,
  type RegisteredOperator,
} from "../../helpers/operator";
import { executeFunctionViaApi } from "../../helpers/function";

test.describe("Execution Factory — Operator E2E flows", () => {
  let backendReady = false;
  const created: RegisteredOperator[] = [];

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
    while (created.length > 0) {
      const item = created.pop();
      if (!item) continue;
      try {
        await cleanupOperatorViaApi(request, item);
      } catch (error) {
        console.warn(`Cleanup failed for ${item.operatorId}: ${String(error)}`);
      }
    }
  });

  test.beforeEach(() => {
    test.skip(!backendReady, "execution-factory backend is not running on :9000");
  });

  test("OP-01: register OpenAPI operator via API", async ({ request }) => {
    const name = buildOperatorName("openapi");
    const operator = await registerOperatorViaApi(request, name, { metadataType: "openapi" });
    created.push(operator);

    expect(operator.operatorId).toBeTruthy();
    expect(operator.name).toBe(name);
  });

  test("OP-02: register function operator via API", async ({ request }) => {
    const name = buildOperatorName("function");
    const operator = await registerOperatorViaApi(request, name, { metadataType: "function" });
    created.push(operator);

    const executeResult = await executeFunctionViaApi(request, { x: 10 });
    expect(executeResult.result?.result).toBe(11);
  });

  test("OP-03: publish operator and verify market listing", async ({ request }) => {
    const name = buildOperatorName("publish");
    const operator = await registerOperatorViaApi(request, name);
    created.push(operator);

    await publishOperatorViaApi(request, operator);

    const market = await request.get(apiUrl("/operator/market?page=1&page_size=20"), {
      headers: { "x-business-domain": "bd_public" },
    });
    expect(market.ok()).toBeTruthy();
    const body = (await market.json()) as { data?: Array<{ operator_id: string }> };
    expect(body.data?.some((item) => item.operator_id === operator.operatorId)).toBeTruthy();
  });

  test("OP-04: impex export then import copy", async ({ request }) => {
    const name = buildOperatorName("impex");
    const operator = await registerOperatorViaApi(request, name);
    created.push(operator);

    const exported = await exportOperatorViaApi(request, operator.operatorId);
    expect(exported).toBeTruthy();

    await importOperatorViaApi(request, exported, "upsert");
  });

  test("OP-05: debug OpenAPI operator", async ({ request }) => {
    const name = buildOperatorName("debug");
    const operator = await registerOperatorViaApi(request, name);
    created.push(operator);

    const debugResult = await debugOperatorViaApi(request, operator, { input: "hello" });
    expect(debugResult).toBeTruthy();
  });
});
