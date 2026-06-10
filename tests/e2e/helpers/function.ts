import type { APIRequestContext } from "@playwright/test";

import { API_PREFIX, defaultApiHeaders, expectOk } from "./common";
import { buildFunctionHandlerCode } from "./operator";

export async function executeFunctionViaApi(
  request: APIRequestContext,
  event: Record<string, unknown> = { x: 41 },
) {
  const response = await request.post(`${API_PREFIX}/function/execute`, {
    headers: {
      ...defaultApiHeaders(),
      "Content-Type": "application/json",
    },
    data: {
      code: buildFunctionHandlerCode(),
      event,
      language: "python",
      timeout: 30,
    },
  });
  await expectOk(response, "Execute function");
  return response.json() as Promise<{
    result?: { result?: number };
    stdout?: string;
    stderr?: string;
  }>;
}

export async function getFunctionPromptViaApi(request: APIRequestContext) {
  const response = await request.get(
    `${API_PREFIX}/ai_generate/prompt/python_function_generator`,
    { headers: defaultApiHeaders() },
  );
  await expectOk(response, "Get function AI prompt");
  return response.json();
}

export async function generateFunctionViaApi(
  request: APIRequestContext,
  query = "Generate a Python handler that adds 1 to event field x.",
) {
  const response = await request.post(
    `${API_PREFIX}/ai_generate/function/python_function_generator`,
    {
      headers: {
        ...defaultApiHeaders(),
        "Content-Type": "application/json",
      },
      data: { query },
    },
  );
  await expectOk(response, "AI generate function");
  return response.json();
}

export async function getPythonTemplateViaApi(request: APIRequestContext) {
  const response = await request.get(`${API_PREFIX}/template/python`, {
    headers: defaultApiHeaders(),
  });
  await expectOk(response, "Get python template");
  return response.json();
}
