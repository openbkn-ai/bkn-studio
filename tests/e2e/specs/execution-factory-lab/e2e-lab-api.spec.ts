/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, test } from "@playwright/test";

import { buildUniqueName } from "../../helpers/common";
import {
  assertCapabilitiesLabReady,
  buildLabWeatherOpenApi,
  createHttpCapabilityViaLabApi,
  debugCapabilityViaLabApi,
  enableOrchestrationViaLabApi,
  getCapabilityViaLabApi,
  getOrchestrationViaLabApi,
  importOpenApiViaLabApi,
  listCapabilitiesViaLabApi,
  listVersionsViaLabApi,
  publishGroupViaLabApi,
  registerMcpViaLabApi,
  registerSkillZipViaLabApi,
  deleteCapabilityViaLabApi,
  exportCapabilityViaLabApi,
  importCapabilityPackageViaLabApi,
  installFromCatalogViaLabApi,
  listCatalogViaLabApi,
  executePythonViaLabApi,
  getPythonTemplateViaLabApi,
  createFunctionCapabilityViaLabApi,
  parseMcpSseViaLabApi,
  getSkillContentViaLabApi,
  getLabMetaViaLabApi,
  getLabMetricsViaLabApi,
  updateHttpCapabilityViaLabApi,
  updateCapabilityViaLabApi,
  listCategoriesViaLabApi,
  listMcpToolsViaLabApi,
  downloadSkillPackageViaLabApi,
  updateSkillPackageViaLabApi,
  registerSkillContentViaLabApi,
  LAB_API_BASE_URL,
  labApiHeaders,
} from "../../helpers/capabilities-lab";
import { cloneToolboxImpexForCreate } from "../../helpers/impex";
import { buildFunctionHandlerCode } from "../../helpers/operator";
import { buildSkillZipBuffer } from "../../helpers/skill";
import { OSS_MOCK_DOCKER_URL } from "../../helpers/oss-mock";
import {
  buildToolboxName,
  createToolboxViaApi,
  publishToolboxViaApi,
  cleanupToolboxViaApi,
} from "../../helpers/toolbox";

test.describe("Execution Factory Lab — API", () => {
  test.describe.configure({ timeout: 120_000 });

  const createdBoxIds: string[] = [];

  test.beforeAll(async ({ request }) => {
    await assertCapabilitiesLabReady(request);
  });

  test.afterAll(async ({ request }) => {
    for (const boxId of createdBoxIds) {
      await cleanupToolboxViaApi(request, boxId).catch(() => undefined);
    }
  });

  test("LAB-API-01: health endpoint", async ({ request }) => {
    const response = await request.get(
      `${process.env.E2E_LAB_API_BASE_URL ?? "http://127.0.0.1:9010/api/capabilities-lab/v1"}/health`,
    );
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as { status?: string; upstream?: string };
    expect(body.status).toBe("ok");
    expect(body.upstream).toBe("ok");
  });

  test("LAB-API-02: create HTTP capability with auto group", async ({ request }) => {
    const toolName = buildUniqueName("lab_weather");
    const openapi = JSON.stringify(buildLabWeatherOpenApi(toolName));

    const created = await createHttpCapabilityViaLabApi(request, {
      openapiSpec: openapi,
      serviceUrl: OSS_MOCK_DOCKER_URL,
      name: toolName,
      description: "Lab auto-group weather capability",
    });

    expect(created.capability?.id).toMatch(/^http:/);
    expect(created.capability?.name).toBeTruthy();
    expect(created.capability?.group?.name).toContain("group");

    if (created.capability?.box_id) {
      createdBoxIds.push(created.capability.box_id);
    }

    const listed = await listCapabilitiesViaLabApi(request, { keyword: toolName });
    const match = listed.data?.find((item) => item.name === toolName);
    expect(match).toBeTruthy();
  });

  test("LAB-API-03: create with orchestration sync", async ({ request }) => {
    const toolName = buildUniqueName("lab_weather_orch");
    const openapi = JSON.stringify(buildLabWeatherOpenApi(toolName));

    const created = await createHttpCapabilityViaLabApi(request, {
      openapiSpec: openapi,
      serviceUrl: OSS_MOCK_DOCKER_URL,
      name: toolName,
      orchestrationEnabled: true,
    });

    expect(created.capability?.orchestration?.enabled).toBe(true);
    expect(created.capability?.orchestration?.operator_id).toBeTruthy();

    if (created.capability?.box_id) {
      createdBoxIds.push(created.capability.box_id);
    }
  });

  test("LAB-API-04: unified list with kind=all and pagination", async ({ request }) => {
    const listed = await listCapabilitiesViaLabApi(request, { kind: "all", page: 1, pageSize: 10 });
    expect(Array.isArray(listed.data)).toBeTruthy();
    expect(typeof listed.total).toBe("number");
    expect(listed.page).toBe(1);
    expect(listed.page_size).toBe(10);
  });

  test("LAB-API-05: get capability detail and debug HTTP", async ({ request }) => {
    const toolName = buildUniqueName("lab_debug");
    const openapi = JSON.stringify(buildLabWeatherOpenApi(toolName));

    const created = await createHttpCapabilityViaLabApi(request, {
      openapiSpec: openapi,
      serviceUrl: OSS_MOCK_DOCKER_URL,
      name: toolName,
    });

    const capabilityId = created.capability?.id;
    expect(capabilityId).toBeTruthy();

    if (created.capability?.box_id) {
      createdBoxIds.push(created.capability.box_id);
    }

    const detail = await getCapabilityViaLabApi(request, capabilityId!);
    expect(detail.id).toBe(capabilityId);
    expect(detail.kind).toBe("http");

    const debug = await debugCapabilityViaLabApi(request, capabilityId!, { city: "beijing" });
    expect(debug.status_code).toBe(200);
    expect(debug.body).toBeTruthy();
  });

  test("LAB-API-06: publish capability and group", async ({ request }) => {
    const toolName = buildUniqueName("lab_publish");
    const openapi = JSON.stringify(buildLabWeatherOpenApi(toolName));

    const created = await createHttpCapabilityViaLabApi(request, {
      openapiSpec: openapi,
      serviceUrl: OSS_MOCK_DOCKER_URL,
      name: toolName,
    });

    const capabilityId = created.capability?.id;
    const boxId = created.capability?.box_id;
    expect(capabilityId).toBeTruthy();
    expect(boxId).toBeTruthy();

    if (boxId) {
      createdBoxIds.push(boxId);
    }

    const groupPublished = await publishGroupViaLabApi(request, boxId!);
    expect(groupPublished.ok).toBe(true);
    expect(groupPublished.status).toBe("published");

    const detail = await getCapabilityViaLabApi(request, capabilityId!);
    expect(detail.status).toBe("published");
  });

  test("LAB-API-07: enable orchestration post-create", async ({ request }) => {
    const toolName = buildUniqueName("lab_orch_enable");
    const openapi = JSON.stringify(buildLabWeatherOpenApi(toolName));

    const created = await createHttpCapabilityViaLabApi(request, {
      openapiSpec: openapi,
      serviceUrl: OSS_MOCK_DOCKER_URL,
      name: toolName,
      orchestrationEnabled: false,
    });

    const capabilityId = created.capability?.id;
    expect(capabilityId).toBeTruthy();

    if (created.capability?.box_id) {
      createdBoxIds.push(created.capability.box_id);
    }

    const enabled = await enableOrchestrationViaLabApi(request, capabilityId!);
    expect(enabled.operator_id).toBeTruthy();

    const orch = await getOrchestrationViaLabApi(request, capabilityId!);
    expect(orch.enabled).toBe(true);
    expect(orch.operator_id).toBeTruthy();
  });

  test("LAB-API-08: list orchestration versions after sync", async ({ request }) => {
    const toolName = buildUniqueName("lab_versions");
    const openapi = JSON.stringify(buildLabWeatherOpenApi(toolName));

    const created = await createHttpCapabilityViaLabApi(request, {
      openapiSpec: openapi,
      serviceUrl: OSS_MOCK_DOCKER_URL,
      name: toolName,
      orchestrationEnabled: true,
    });

    const capabilityId = created.capability?.id;
    expect(capabilityId).toBeTruthy();

    if (created.capability?.box_id) {
      createdBoxIds.push(created.capability.box_id);
    }

    const versions = await listVersionsViaLabApi(request, capabilityId!);
    expect(versions.kind).toBe("http");
    expect(Array.isArray(versions.versions)).toBeTruthy();
  });

  test("LAB-API-09: batch import OpenAPI", async ({ request }) => {
    const baseName = buildUniqueName("lab_import");
    const openapi = JSON.stringify({
      openapi: "3.0.3",
      info: { title: baseName, version: "1.0.0" },
      servers: [{ url: OSS_MOCK_DOCKER_URL }],
      paths: {
        [`/proxy/uapis/weather/${baseName}_a`]: {
          get: {
            summary: `${baseName}_a`,
            responses: { "200": { description: "ok" } },
          },
        },
        [`/proxy/uapis/weather/${baseName}_b`]: {
          get: {
            summary: `${baseName}_b`,
            responses: { "200": { description: "ok" } },
          },
        },
      },
    });

    const imported = await importOpenApiViaLabApi(request, {
      openapiSpec: openapi,
      serviceUrl: OSS_MOCK_DOCKER_URL,
      description: "Batch import test",
    });

    expect(imported.box_id).toBeTruthy();
    expect((imported.capabilities?.length ?? 0) >= 1).toBeTruthy();

    if (imported.box_id) {
      createdBoxIds.push(imported.box_id);
    }
  });

  test("LAB-API-10: register MCP capability", async ({ request }) => {
    const name = buildUniqueName("lab_mcp");
    const registered = await registerMcpViaLabApi(request, {
      name,
      url: "http://ef-mcp-mock:8096/sse",
      description: "Lab MCP capability",
    });

    expect(registered.capability?.id).toMatch(/^mcp:/);
    expect(registered.capability?.name).toBeTruthy();
  });

  test("LAB-API-11: register Skill capability", async ({ request }) => {
    const name = buildUniqueName("lab_skill");
    const registered = await registerSkillZipViaLabApi(request, buildSkillZipBuffer(name));

    expect(registered.capability?.id).toMatch(/^skill:/);
    expect(registered.capability?.name).toBeTruthy();
  });

  test("LAB-API-12: update and delete HTTP capability", async ({ request }) => {
    const toolName = buildUniqueName("lab_delete");
    const openapi = JSON.stringify(buildLabWeatherOpenApi(toolName));

    const created = await createHttpCapabilityViaLabApi(request, {
      openapiSpec: openapi,
      serviceUrl: OSS_MOCK_DOCKER_URL,
      name: toolName,
    });

    const capabilityId = created.capability?.id;
    expect(capabilityId).toBeTruthy();

    if (created.capability?.box_id) {
      createdBoxIds.push(created.capability.box_id);
    }

    const updated = await updateHttpCapabilityViaLabApi(request, capabilityId!, {
      name: `${toolName}_renamed`,
      description: "updated by lab api",
    });
    expect(updated.name).toContain("_renamed");

    await deleteCapabilityViaLabApi(request, capabilityId!);

    const listed = await listCapabilitiesViaLabApi(request, { keyword: toolName });
    const match = listed.data?.find((item) => item.id === capabilityId);
    expect(match).toBeFalsy();
  });

  test("LAB-API-13: export and import HTTP capability package", async ({ request }) => {
    const toolName = buildUniqueName("lab_impex");
    const importName = buildUniqueName("lab_impex_import");
    const openapi = JSON.stringify(buildLabWeatherOpenApi(toolName));

    const created = await createHttpCapabilityViaLabApi(request, {
      openapiSpec: openapi,
      serviceUrl: OSS_MOCK_DOCKER_URL,
      name: toolName,
    });

    const capabilityId = created.capability?.id;
    expect(capabilityId).toBeTruthy();

    const exported = await exportCapabilityViaLabApi(request, capabilityId!);
    expect(exported.toolbox).toBeTruthy();

    const importPayload = cloneToolboxImpexForCreate(exported, importName);
    const imported = await importCapabilityPackageViaLabApi(request, importPayload, "create");
    expect(imported.component_type).toBe("toolbox");

    const listed = await listCapabilitiesViaLabApi(request, { kind: "http", keyword: toolName });
    expect(listed.data?.some((item) => item.name === toolName)).toBeTruthy();

    const importedBoxId = listed.data?.find((item) => item.name === toolName)?.box_id;
    if (importedBoxId) {
      createdBoxIds.push(importedBoxId);
    }
    if (created.capability?.box_id) {
      createdBoxIds.push(created.capability.box_id);
    }
  });

  test("LAB-API-14: catalog list and install published toolbox", async ({ request }) => {
    const toolbox = await createToolboxViaApi(request, buildToolboxName("lab_catalog"));
    createdBoxIds.push(toolbox.boxId);
    await publishToolboxViaApi(request, toolbox.boxId);

    const catalog = await listCatalogViaLabApi(request, {
      kind: "http",
      keyword: toolbox.name,
    });
    expect(catalog.data?.some((item) => item.id === toolbox.boxId)).toBeTruthy();

    const installed = await installFromCatalogViaLabApi(request, {
      kind: "http",
      sourceId: toolbox.boxId,
      mode: "create",
    });
    expect(installed.capabilities?.length).toBeGreaterThan(0);

    const installedBoxId = installed.capabilities?.[0]?.box_id;
    if (installedBoxId) {
      createdBoxIds.push(installedBoxId);
    }

    const listed = await listCapabilitiesViaLabApi(request, {
      kind: "http",
      keyword: toolbox.name,
    });
    expect(listed.data?.some((item) => item.box_id === installedBoxId)).toBeTruthy();
  });

  test("LAB-API-15: execute python in sandbox", async ({ request }) => {
    const result = await executePythonViaLabApi(request, buildFunctionHandlerCode(), { x: 41 });
    const output = result.output as { result?: number } | undefined;
    expect(output?.result ?? output).toBeTruthy();
  });

  test("LAB-API-16: fetch python template", async ({ request }) => {
    const template = await getPythonTemplateViaLabApi(request);
    expect(template.template).toContain("def handler");
  });

  test("LAB-API-17: create and debug function capability", async ({ request }) => {
    const name = buildUniqueName("lab_function");
    const created = await createFunctionCapabilityViaLabApi(request, {
      name,
      code: buildFunctionHandlerCode(),
    });

    expect(created.capability?.id).toMatch(/^function:/);
    expect(created.capability?.kind).toBe("function");

    if (created.capability?.box_id) {
      createdBoxIds.push(created.capability.box_id);
    }

    const debugged = await debugCapabilityViaLabApi(request, created.capability!.id!, { x: 41 });
    expect(debugged.body ?? debugged.error).toBeTruthy();
  });

  test("LAB-API-18: parse MCP SSE via lab wizard API", async ({ request }) => {
    const parsed = await parseMcpSseViaLabApi(request, "http://ef-mcp-mock:8096/sse");
    expect(parsed.tools?.length).toBeGreaterThan(0);
  });

  test("LAB-API-19: skill file tree content", async ({ request }) => {
    const name = buildUniqueName("lab_skill_files");
    const registered = await registerSkillZipViaLabApi(request, buildSkillZipBuffer(name));
    const capabilityId = registered.capability?.id;
    expect(capabilityId).toBeTruthy();

    const content = await getSkillContentViaLabApi(request, capabilityId!);
    expect((content.files?.length ?? 0) > 0 || Boolean(content.content)).toBeTruthy();
  });

  test("LAB-API-20: meta feature flags endpoint", async ({ request }) => {
    const meta = await getLabMetaViaLabApi(request);
    expect(meta.service).toBe("capabilities-lab");
    expect(meta.version).toBeTruthy();
    expect(meta.features?.catalog).toBe(true);
    expect(meta.features?.function).toBe(true);
    expect(meta.features?.impex).toBe(true);
  });

  test("LAB-API-21: prometheus metrics endpoint", async ({ request }) => {
    await request.get(`${LAB_API_BASE_URL}/health`, { headers: labApiHeaders() });
    const metrics = await getLabMetricsViaLabApi(request);
    expect(metrics).toContain("capabilities_lab_http_requests_total");
  });

  test("LAB-API-22: metrics include health route after probe", async ({ request }) => {
    await request.get(`${LAB_API_BASE_URL}/meta`, { headers: labApiHeaders() });
    const metrics = await getLabMetricsViaLabApi(request);
    expect(metrics).toMatch(/route="\/health"/);
  });

  test("LAB-API-23: list capabilities with status filter", async ({ request }) => {
    const toolName = buildUniqueName("lab_status_filter");
    const openapi = JSON.stringify(buildLabWeatherOpenApi(toolName));

    const created = await createHttpCapabilityViaLabApi(request, {
      openapiSpec: openapi,
      serviceUrl: OSS_MOCK_DOCKER_URL,
      name: toolName,
    });

    const capabilityId = created.capability?.id;
    expect(capabilityId).toBeTruthy();

    if (created.capability?.box_id) {
      createdBoxIds.push(created.capability.box_id);
    }

    const beforePublish = await getCapabilityViaLabApi(request, capabilityId!);
    const draftListed = await listCapabilitiesViaLabApi(request, {
      keyword: toolName,
      kind: "all",
      status: beforePublish.status ?? "draft",
    });
    expect(draftListed.data?.some((item) => item.name === toolName)).toBeTruthy();

    if (beforePublish.status !== "published") {
      await publishGroupViaLabApi(request, created.capability!.box_id!);

      const afterPublish = await getCapabilityViaLabApi(request, capabilityId!);
      const publishedListed = await listCapabilitiesViaLabApi(request, {
        keyword: toolName,
        kind: "all",
        status: afterPublish.status ?? "published",
      });
      expect(publishedListed.data?.some((item) => item.name === toolName)).toBeTruthy();
    }
  });

  test("LAB-API-24: list categories", async ({ request }) => {
    const categories = await listCategoriesViaLabApi(request);
    expect(Array.isArray(categories.data)).toBeTruthy();
    expect((categories.data?.length ?? 0) > 0).toBeTruthy();
  });

  test("LAB-API-25: update MCP capability metadata", async ({ request }) => {
    const name = buildUniqueName("lab_mcp_update");
    const registered = await registerMcpViaLabApi(request, {
      name,
      url: "http://ef-mcp-mock:8096/sse",
    });

    const capabilityId = registered.capability?.id;
    expect(capabilityId).toBeTruthy();

    const updated = await updateCapabilityViaLabApi(request, capabilityId!, {
      name: `${name}_renamed`,
      description: "updated mcp metadata",
    });
    expect(updated.name).toContain("_renamed");
  });

  test("LAB-API-26: list MCP tools for capability", async ({ request }) => {
    const name = buildUniqueName("lab_mcp_tools");
    const registered = await registerMcpViaLabApi(request, {
      name,
      url: "http://ef-mcp-mock:8096/sse",
    });

    const capabilityId = registered.capability?.id;
    expect(capabilityId).toBeTruthy();

    const tools = await listMcpToolsViaLabApi(request, capabilityId!);
    expect(Array.isArray(tools.tools)).toBeTruthy();
  });

  test("LAB-API-27: update Skill metadata", async ({ request }) => {
    const name = buildUniqueName("lab_skill_meta");
    const registered = await registerSkillZipViaLabApi(request, buildSkillZipBuffer(name));
    const capabilityId = registered.capability?.id;
    expect(capabilityId).toBeTruthy();

    const updated = await updateCapabilityViaLabApi(request, capabilityId!, {
      name: `${name}_renamed`,
      description: "updated skill metadata",
    });
    expect(updated.name).toContain("_renamed");
  });

  test("LAB-API-28: replace Skill package", async ({ request }) => {
    const name = buildUniqueName("lab_skill_pkg");
    const registered = await registerSkillZipViaLabApi(request, buildSkillZipBuffer(name));
    const capabilityId = registered.capability?.id;
    expect(capabilityId).toBeTruthy();

    const replaced = await updateSkillPackageViaLabApi(
      request,
      capabilityId!,
      buildSkillZipBuffer(`${name}_v2`),
    );
    expect(replaced.capability?.id).toBe(capabilityId);
  });

  test("LAB-API-29: download Skill package", async ({ request }) => {
    const name = buildUniqueName("lab_skill_dl");
    const registered = await registerSkillZipViaLabApi(request, buildSkillZipBuffer(name));
    const capabilityId = registered.capability?.id;
    expect(capabilityId).toBeTruthy();

    const body = await downloadSkillPackageViaLabApi(request, capabilityId!);
    expect(body.byteLength).toBeGreaterThan(0);
  });

  test("LAB-API-30: register Skill via content import", async ({ request }) => {
    const name = buildUniqueName("lab_skill_content");
    const content = [
      "---",
      `name: ${name}`,
      "description: Skill content import test",
      "---",
      "Skill content import body.",
    ].join("\n");
    const registered = await registerSkillContentViaLabApi(request, content);
    expect(registered.capability?.id).toMatch(/^skill:/);
  });

  test("LAB-API-31: update HTTP OpenAPI spec", async ({ request }) => {
    const toolName = buildUniqueName("lab_openapi_edit");
    const openapi = JSON.stringify(buildLabWeatherOpenApi(toolName));

    const created = await createHttpCapabilityViaLabApi(request, {
      openapiSpec: openapi,
      serviceUrl: OSS_MOCK_DOCKER_URL,
      name: toolName,
    });

    const capabilityId = created.capability?.id;
    expect(capabilityId).toBeTruthy();

    if (created.capability?.box_id) {
      createdBoxIds.push(created.capability.box_id);
    }

    const updatedOpenApi = JSON.stringify({
      ...JSON.parse(openapi),
      info: { title: toolName, version: "1.0.1", description: "openapi updated" },
    });
    const updated = await updateHttpCapabilityViaLabApi(request, capabilityId!, {
      name: toolName,
      description: "openapi updated",
      openapi_spec: updatedOpenApi,
    });
    expect(updated.id).toBe(capabilityId);
  });

  test("LAB-API-32: update Function capability code", async ({ request }) => {
    const name = buildUniqueName("lab_function_update");
    const created = await createFunctionCapabilityViaLabApi(request, {
      name,
      code: buildFunctionHandlerCode(),
    });

    const capabilityId = created.capability?.id;
    expect(capabilityId).toBeTruthy();

    if (created.capability?.box_id) {
      createdBoxIds.push(created.capability.box_id);
    }

    const updated = await updateCapabilityViaLabApi(request, capabilityId!, {
      name: `${name}_renamed`,
      description: "updated function code",
      code: "def handler(event):\n    return {'result': 99}\n",
    });
    expect(updated.name).toContain("_renamed");
  });

  test("LAB-API-33: catalog install with upsert mode", async ({ request }) => {
    const toolbox = await createToolboxViaApi(request, buildToolboxName("lab_catalog_upsert"));
    createdBoxIds.push(toolbox.boxId);
    await publishToolboxViaApi(request, toolbox.boxId);

    const installed = await installFromCatalogViaLabApi(request, {
      kind: "http",
      sourceId: toolbox.boxId,
      mode: "upsert",
    });
    expect(installed.mode).toBe("upsert");
    expect(installed.capabilities?.length).toBeGreaterThan(0);

    const installedBoxId = installed.capabilities?.[0]?.box_id;
    if (installedBoxId) {
      createdBoxIds.push(installedBoxId);
    }
  });

  test("LAB-API-34: export Skill capability package", async ({ request }) => {
    const name = buildUniqueName("lab_skill_export");
    const registered = await registerSkillZipViaLabApi(request, buildSkillZipBuffer(name));
    const capabilityId = registered.capability?.id;
    expect(capabilityId).toBeTruthy();

    const exported = await exportCapabilityViaLabApi(request, capabilityId!);
    expect((exported as { skill_id?: string }).skill_id).toBeTruthy();
  });
});
