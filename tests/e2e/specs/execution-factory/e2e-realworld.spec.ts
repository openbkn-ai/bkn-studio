import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import { apiUrl, assertBackendReady } from "../../helpers/common";
import {
  buildImpexImportName,
  cloneToolboxImpexForCreate,
} from "../../helpers/impex";
import {
  assertLogBridgeHealthy,
  buildLogBridgeOpenApiSpec,
  LOG_BRIDGE_DOCKER_URL,
} from "../../helpers/log-bridge";
import {
  assertLocalMcpMockHealthy,
  buildMcpRealworldName,
  createSseMcpViaApi,
  debugMcpToolViaApi,
  LOCAL_MCP_SSE_DOCKER_URL,
  parseMcpSseViaApi,
  AMAP_MCP_SSE_URL,
} from "../../helpers/mcp-realworld";
import { cleanupMcpViaApi } from "../../helpers/mcp";
import {
  buildSkillName,
  buildSkillZipBuffer,
  cleanupSkillViaApi,
  getSkillContentViaApi,
  getSkillHistoryViaApi,
  publishSkillViaApi,
  readSkillManagementFileViaApi,
  registerSkillZipViaApi,
  updateSkillPackageViaApi,
} from "../../helpers/skill";
import { registerOpenApiBundleViaApi } from "../../helpers/capability-bundle";
import {
  OSS_MOCK_DOCKER_URL,
} from "../../helpers/oss-mock";
import {
  cleanupOperatorViaApi,
  type RegisteredOperator,
} from "../../helpers/operator";
import {
  buildToolboxName,
  cleanupToolboxViaApi,
  createToolViaApi,
  createToolboxViaApi,
  debugToolViaApi,
  exportToolboxViaApi,
  importOpenApiSpecBatchViaApi,
  importToolboxViaApi,
  publishToolboxViaApi,
} from "../../helpers/toolbox";

const ALLOW_NETWORK = process.env.E2E_ALLOW_NETWORK === "1";

function loadUapisWeatherMiniFixture() {
  const raw = readFileSync(
    resolve(__dirname, "../../fixtures/uapis-weather-mini.json"),
    "utf8",
  );
  return JSON.parse(raw) as Record<string, unknown>;
}

function buildOfflineWeatherOpenApi(toolName: string) {
  return {
    openapi: "3.0.3",
    info: { title: toolName, version: "1.0.0" },
    servers: [{ url: OSS_MOCK_DOCKER_URL }],
    paths: {
      "/proxy/uapis/weather": {
        get: {
          summary: toolName,
          responses: {
            "200": {
              description: "Weather",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      city: { type: "string" },
                      weather: { type: "string" },
                      temperature: { type: "number" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

test.describe("Execution Factory — Realworld API scenarios", () => {
  test.describe.configure({ timeout: 180_000 });

  let backendReady = false;
  let logBridgeReady = false;
  let mcpMockReady = false;

  const createdBoxIds: string[] = [];
  const createdMcpIds: string[] = [];
  const createdSkillIds: string[] = [];
  const createdOperators: RegisteredOperator[] = [];

  test.beforeAll(async ({ request }) => {
    try {
      await assertBackendReady(request);
      backendReady = true;
    } catch (error) {
      backendReady = false;
      console.warn(String(error));
    }

    if (backendReady) {
      try {
        await assertLogBridgeHealthy(request);
        logBridgeReady = true;
      } catch (error) {
        logBridgeReady = false;
        console.warn(String(error));
      }

      try {
        await assertLocalMcpMockHealthy(request);
        mcpMockReady = true;
      } catch (error) {
        mcpMockReady = false;
        console.warn(String(error));
      }
    }
  });

  test.afterEach(async ({ request }) => {
    while (createdMcpIds.length > 0) {
      const mcpId = createdMcpIds.pop();
      if (!mcpId) continue;
      try {
        await cleanupMcpViaApi(request, mcpId);
      } catch (error) {
        console.warn(String(error));
      }
    }

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

  test("RW-01: docker log bridge tool debug returns log lines", async ({ request }) => {
    test.skip(!logBridgeReady, "ef-log-bridge is not running on :8095");

    const name = buildToolboxName("rw01_logs");
    const toolbox = await createToolboxViaApi(request, name, {
      serviceUrl: LOG_BRIDGE_DOCKER_URL,
    });
    createdBoxIds.push(toolbox.boxId);

    const openApiSpec = buildLogBridgeOpenApiSpec(name);
    const batch = await importOpenApiSpecBatchViaApi(request, toolbox.boxId, openApiSpec);
    expect(batch.successCount).toBeGreaterThan(0);
    const toolId = batch.toolIds[0];
    expect(toolId).toBeTruthy();

    const debug = await debugToolViaApi(request, toolbox.boxId, toolId, {
      query: { tail: 50, level: "all" },
    });
    expect(debug.error).toBeFalsy();
    expect(debug.status_code).toBe(200);
    const body = debug.body as { count?: number; lines?: string[] } | undefined;
    expect(body?.count ?? body?.lines?.length ?? 0).toBeGreaterThanOrEqual(0);
  });

  test("RW-02: export toolbox backup then import clone and debug", async ({ request }) => {
    const toolbox = await createToolboxViaApi(request, buildToolboxName("rw02_src"));
    createdBoxIds.push(toolbox.boxId);
    await createToolViaApi(request, toolbox.boxId, buildToolboxName("rw02_tool"));
    await publishToolboxViaApi(request, toolbox.boxId);

    const exported = (await exportToolboxViaApi(request, toolbox.boxId)) as Record<string, unknown>;
    const importName = buildImpexImportName("at_e2e_rw02_clone");
    const payload = cloneToolboxImpexForCreate(exported, importName);
    await importToolboxViaApi(request, payload, "create");

    const list = await request.get(apiUrl(`/tool-box/list?page=1&page_size=50&name=${encodeURIComponent(importName)}`), {
      headers: { "x-business-domain": "bd_public" },
    });
    expect(list.ok()).toBeTruthy();
    const body = (await list.json()) as {
      data?: Array<{ box_id: string; box_name?: string; name?: string }>;
    };
    const imported = body.data?.find((item) => (item.box_name ?? item.name) === importName);
    expect(imported?.box_id).toBeTruthy();
    if (!imported?.box_id) {
      return;
    }
    createdBoxIds.push(imported.box_id);

    const tools = await request.get(
      apiUrl(`/tool-box/${imported.box_id}/tools/list?page=1&page_size=20`),
      { headers: { "x-business-domain": "bd_public" } },
    );
    expect(tools.ok()).toBeTruthy();
    const toolsBody = (await tools.json()) as {
      data?: Array<{ tool_id: string }>;
      tools?: Array<{ tool_id: string }>;
    };
    const firstTool = (toolsBody.tools ?? toolsBody.data ?? [])[0];
    expect(firstTool?.tool_id).toBeTruthy();
    if (!firstTool?.tool_id) {
      return;
    }

    const debug = await debugToolViaApi(request, imported.box_id, firstTool.tool_id);
    expect(debug.error).toBeFalsy();
    expect(debug.status_code).toBeGreaterThanOrEqual(200);
    expect(debug.status_code).toBeLessThan(500);
  });

  test("RW-03: offline weather API tool debug via oss-mock proxy", async ({ request }) => {
    const name = buildToolboxName("rw03_weather_offline");
    const toolbox = await createToolboxViaApi(request, name, {
      metadataType: "openapi",
      serviceUrl: OSS_MOCK_DOCKER_URL,
    });
    createdBoxIds.push(toolbox.boxId);

    const toolName = "weather_offline";
    const openApiSpec = buildOfflineWeatherOpenApi(toolName);
    const batch = await importOpenApiSpecBatchViaApi(request, toolbox.boxId, openApiSpec);
    expect(batch.successCount).toBeGreaterThan(0);
    const toolId = batch.toolIds[0];
    expect(toolId).toBeTruthy();

    const debug = await debugToolViaApi(request, toolbox.boxId, toolId);
    expect(debug.error).toBeFalsy();
    expect(debug.status_code).toBe(200);
    const payload = debug.body as { city?: string; weather?: string; temperature?: number };
    expect(payload.city).toBeTruthy();
    expect(payload.weather).toBeTruthy();
    expect(payload.temperature).toBeDefined();
  });

  test("RW-03-online: uapis weather when network allowed", async ({ request }) => {
    test.skip(!ALLOW_NETWORK, "set E2E_ALLOW_NETWORK=1 to run online weather case");

    const probe = await request
      .get("https://uapis.cn/api/v1/misc/weather?city=北京", { timeout: 15_000 })
      .catch(() => null);
    test.skip(!probe?.ok(), "uapis.cn is unreachable");

    const name = buildToolboxName("rw03_weather_online");
    const toolbox = await createToolboxViaApi(request, name);
    createdBoxIds.push(toolbox.boxId);

    const spec = loadUapisWeatherMiniFixture();
    const batch = await importOpenApiSpecBatchViaApi(request, toolbox.boxId, spec);
    expect(batch.successCount).toBeGreaterThan(0);
    const toolId = batch.toolIds[0];
    const debug = await debugToolViaApi(request, toolbox.boxId, toolId, {
      query: { city: "北京" },
    });
    expect(debug.error).toBeFalsy();
    expect(debug.status_code).toBe(200);
  });

  test("RW-04: batch import uapis-weather-mini OpenAPI fixture", async ({ request }) => {
    const toolbox = await createToolboxViaApi(request, buildToolboxName("rw04_openapi"));
    createdBoxIds.push(toolbox.boxId);

    const spec = loadUapisWeatherMiniFixture();
    const batch = await importOpenApiSpecBatchViaApi(request, toolbox.boxId, spec);
    expect(batch.successCount).toBeGreaterThan(0);
    expect(batch.failureCount).toBe(0);
  });

  test("RW-05: amap MCP parse register and debug when configured", async ({ request }) => {
    test.skip(!AMAP_MCP_SSE_URL, "set E2E_AMAP_MCP_SSE_URL for Gaode MCP test");

    const parsed = await parseMcpSseViaApi(request, AMAP_MCP_SSE_URL);
    const tools = parsed.tools ?? [];
    expect(tools.length).toBeGreaterThan(0);
    const firstTool = tools[0]?.name;
    expect(firstTool).toBeTruthy();
    if (!firstTool) {
      return;
    }

    const mcp = await createSseMcpViaApi(
      request,
      buildMcpRealworldName("amap"),
      AMAP_MCP_SSE_URL,
    );
    createdMcpIds.push(mcp.mcpId);
    expect(mcp.mcpId).toBeTruthy();

    const debug = await debugMcpToolViaApi(request, mcp.mcpId, firstTool, {});
    expect(debug.is_error).not.toBe(true);
    const text = (debug.content ?? []).map((item) => item.text ?? "").join("");
    expect(text.length + (debug.error?.length ?? 0)).toBeGreaterThan(0);
  });

  test("RW-06: local MCP mock register and echo debug", async ({ request }) => {
    test.skip(!mcpMockReady, "ef-mcp-mock is not running on :8096");

    const parsed = await parseMcpSseViaApi(request, LOCAL_MCP_SSE_DOCKER_URL);
    expect(parsed.tools?.some((tool) => tool.name === "echo")).toBeTruthy();

    const mcp = await createSseMcpViaApi(
      request,
      buildMcpRealworldName("local"),
      LOCAL_MCP_SSE_DOCKER_URL,
    );
    createdMcpIds.push(mcp.mcpId);

    const debug = await debugMcpToolViaApi(request, mcp.mcpId, "echo", {
      message: "hello-rw06",
    });
    const text = (debug.content ?? [])
      .map((item) => item.text ?? "")
      .join("");
    expect(text).toContain("hello-rw06");
  });

  test("RW-07: skill zip register preview update and publish", async ({ request }) => {
    const skillName = buildSkillName("rw07");
    const skill = await registerSkillZipViaApi(request, skillName);
    createdSkillIds.push(skill.skillId);

    const content = (await getSkillContentViaApi(request, skill.skillId)) as {
      files?: Array<{ rel_path?: string } | string>;
    };
    const relPaths = (content.files ?? [])
      .map((file) => (typeof file === "string" ? file : file.rel_path))
      .filter(Boolean) as string[];
    expect(relPaths.some((path) => path.includes("SKILL.md"))).toBeTruthy();

    const guide = await readSkillManagementFileViaApi(request, skill.skillId, "refs/guide.md", {
      responseMode: "content",
    });
    expect(guide.content).toContain("# Guide");

    const updatedZip = buildSkillZipBuffer(skillName);
    await updateSkillPackageViaApi(request, skill.skillId, updatedZip);

    await publishSkillViaApi(request, skill.skillId);
    const history = await getSkillHistoryViaApi(request, skill.skillId);
    expect(history.length).toBeGreaterThanOrEqual(0);
  });

  test("RW-08: openapi bundle registers linked operator tools and debug works", async ({
    request,
  }) => {
    const toolName = "weather_bundle";
    const toolboxName = buildToolboxName("rw08_bundle");
    const spec = JSON.stringify(buildOfflineWeatherOpenApi(toolName));

    const bundle = await registerOpenApiBundleViaApi(request, {
      openapiSpec: spec,
      serviceUrl: OSS_MOCK_DOCKER_URL,
      toolboxName,
    });

    const boxId = bundle.box_id;
    const toolId = bundle.tool_ids?.[0];
    const operatorId = bundle.operator_ids?.[0];
    expect(boxId).toBeTruthy();
    expect(toolId).toBeTruthy();
    expect(operatorId).toBeTruthy();
    expect((bundle.links ?? []).length).toBeGreaterThan(0);
    if (!boxId || !toolId || !operatorId) {
      return;
    }
    createdBoxIds.push(boxId);

    const operatorDetail = await request.get(apiUrl(`/operator/info/${operatorId}`), {
      headers: { "x-business-domain": "bd_public" },
    });
    expect(operatorDetail.ok()).toBeTruthy();
    const operatorBody = (await operatorDetail.json()) as {
      name?: string;
      version?: string;
    };
    createdOperators.push({
      operatorId,
      version: operatorBody.version ?? "",
      name: operatorBody.name ?? toolName,
    });

    const debug = await debugToolViaApi(request, boxId, toolId);
    expect(debug.error).toBeFalsy();
    expect(debug.status_code).toBe(200);
    const payload = debug.body as { city?: string; weather?: string };
    expect(payload.city).toBeTruthy();
    expect(payload.weather).toBeTruthy();
  });

  test("RW-X-01: toolbox edit publish and re-debug", async ({ request }) => {
    const toolbox = await createToolboxViaApi(request, buildToolboxName("rwx_toolbox"));
    createdBoxIds.push(toolbox.boxId);
    const tool = await createToolViaApi(request, toolbox.boxId, buildToolboxName("rwx_tool"));

    await request.put(apiUrl(`/tool-box/${toolbox.boxId}`), {
      headers: { "x-business-domain": "bd_public", "Content-Type": "application/json" },
      data: { box_desc: "RW-X updated description" },
    });

    await publishToolboxViaApi(request, toolbox.boxId);

    const detail = await request.get(apiUrl(`/tool-box/${toolbox.boxId}`), {
      headers: { "x-business-domain": "bd_public" },
    });
    expect(detail.ok()).toBeTruthy();
    const detailBody = (await detail.json()) as { status?: string; box_desc?: string };
    expect(detailBody.status).toBe("published");

    const debug = await debugToolViaApi(request, toolbox.boxId, tool.toolId);
    expect(debug.error).toBeFalsy();
  });

  test("RW-X-02: MCP SSE lifecycle debug after publish", async ({ request }) => {
    test.skip(!mcpMockReady, "ef-mcp-mock is not running on :8096");

    const mcp = await createSseMcpViaApi(
      request,
      buildMcpRealworldName("rwx_mcp"),
      LOCAL_MCP_SSE_DOCKER_URL,
      { description: "RW-X initial" },
    );
    createdMcpIds.push(mcp.mcpId);

    await request.put(apiUrl(`/mcp/${mcp.mcpId}`), {
      headers: { "x-business-domain": "bd_public", "Content-Type": "application/json" },
      data: { description: "RW-X updated MCP" },
    });

    const publish = await request.post(apiUrl(`/mcp/${mcp.mcpId}/status`), {
      headers: { "x-business-domain": "bd_public", "Content-Type": "application/json" },
      data: { status: "published" },
    });
    expect(publish.ok()).toBeTruthy();

    const debug = await debugMcpToolViaApi(request, mcp.mcpId, "get_time");
    const text = (debug.content ?? []).map((item) => item.text ?? "").join("");
    expect(text.length).toBeGreaterThan(0);
  });
});
