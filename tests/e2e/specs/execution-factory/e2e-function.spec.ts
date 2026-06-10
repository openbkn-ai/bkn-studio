import { expect, test } from "@playwright/test";

import { assertBackendReady } from "../../helpers/common";
import {
  executeFunctionViaApi,
  generateFunctionViaApi,
  getFunctionPromptViaApi,
  getPythonTemplateViaApi,
} from "../../helpers/function";

test.describe("Execution Factory — Function sandbox E2E flows", () => {
  let backendReady = false;

  test.beforeAll(async ({ request }) => {
    try {
      await assertBackendReady(request);
      backendReady = true;
    } catch (error) {
      backendReady = false;
      console.warn(String(error));
    }
  });

  test.beforeEach(() => {
    test.skip(!backendReady, "execution-factory backend is not running on :9000");
  });

  test("FN-01: execute python handler in sandbox", async ({ request }) => {
    const result = await executeFunctionViaApi(request, { x: 41 });
    expect(result.result?.result).toBe(42);
  });

  test("FN-02: fetch python function template", async ({ request }) => {
    const template = await getPythonTemplateViaApi(request);
    expect(template).toBeTruthy();
  });

  test("FN-03: fetch AI function generator prompt", async ({ request }) => {
    const prompt = await getFunctionPromptViaApi(request);
    expect(prompt).toBeTruthy();
  });

  test("FN-04: AI generate python function code", async ({ request }) => {
    const generated = await generateFunctionViaApi(request);
    expect(generated).toBeTruthy();
  });
});
