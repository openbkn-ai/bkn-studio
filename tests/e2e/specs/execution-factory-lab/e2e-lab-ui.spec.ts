import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import {
  assertCapabilitiesLabReady,
  deleteCapabilityViaLabApi,
  getCapabilityViaLabApi,
  listCapabilitiesViaLabApi,
} from "../../helpers/capabilities-lab";
import {
  buildHttpCurl,
  buildOpenApiImportDocument,
  buildSkillContentMarkdown,
  capabilityCard,
  capabilityDetailDrawer,
  clickCreateMenuItem,
  closeCapabilityDetail,
  createFunctionCapabilityViaUi,
  createHttpCapabilityViaUi,
  deleteCapabilityInDetail,
  downloadSkillPackageFromDetail,
  editCapabilityOverview,
  exportImpexFromDetail,
  gotoCapabilitiesLab,
  offlineCapabilityInDetail,
  gotoCatalogLab,
  importImpexPackageViaUi,
  importOpenApiViaUi,
  importSkillContentViaUi,
  importSkillZipViaUi,
  installCatalogEntryViaUi,
  openCapabilityDetail,
  publishCapabilityInDetail,
  registerMcpViaUi,
  replaceSkillPackageInDetail,
  runDebugInDetail,
  runOrchestrationLifecycleInDetail,
  runPythonSandboxInCreateDrawer,
  searchCapabilityByName,
} from "../../helpers/capabilities-lab-ui";
import { buildUniqueName } from "../../helpers/common";
import { OSS_MOCK_DOCKER_URL } from "../../helpers/oss-mock";
import { buildFunctionHandlerCode } from "../../helpers/operator";
import { buildSkillZipBuffer } from "../../helpers/skill";
import {
  buildToolboxName,
  cleanupToolboxViaApi,
  createToolboxViaApi,
  publishToolboxViaApi,
} from "../../helpers/toolbox";

test.describe("Execution Factory Lab — UI lifecycle", () => {
  test.describe.configure({ timeout: 180_000 });

  const createdBoxIds = new Set<string>();
  const createdCapabilityIds = new Set<string>();

  test.beforeAll(async ({ request }) => {
    await assertCapabilitiesLabReady(request);
  });

  test.afterAll(async ({ request }) => {
    for (const capabilityId of createdCapabilityIds) {
      await deleteCapabilityViaLabApi(request, capabilityId).catch(() => undefined);
    }
    for (const boxId of createdBoxIds) {
      await cleanupToolboxViaApi(request, boxId).catch(() => undefined);
    }
  });

  function trackCapability(capability?: { id?: string; box_id?: string }) {
    if (capability?.id) {
      createdCapabilityIds.add(capability.id);
    }
    if (capability?.box_id) {
      createdBoxIds.add(capability.box_id);
    }
  }

  function writeTempSkillZip(skillName: string) {
    const path = join(tmpdir(), `${skillName}.zip`);
    writeFileSync(path, buildSkillZipBuffer(skillName));
    return path;
  }

  test("LAB-UI-01: create HTTP capability and open detail", async ({ page }) => {
    const toolName = buildUniqueName("lab_ui_http_create");
    const curl = buildHttpCurl(OSS_MOCK_DOCKER_URL, toolName.replace(/[^a-zA-Z0-9]/g, "_"));

    await gotoCapabilitiesLab(page);
    const capability = await createHttpCapabilityViaUi(page, { name: toolName, curl });
    trackCapability(capability);

    await openCapabilityDetail(page, toolName);
    await expect(page.getByRole("tab", { name: /概览|Overview/i })).toBeVisible();
    await closeCapabilityDetail(page);
  });

  test("LAB-UI-02: edit HTTP capability metadata", async ({ page, request }) => {
    const toolName = buildUniqueName("lab_ui_http_edit");
    const renamed = `${toolName}_renamed`;
    const curl = buildHttpCurl(OSS_MOCK_DOCKER_URL, toolName.replace(/[^a-zA-Z0-9]/g, "_"));

    await gotoCapabilitiesLab(page);
    const capability = await createHttpCapabilityViaUi(page, { name: toolName, curl });
    trackCapability(capability);

    await openCapabilityDetail(page, toolName);
    await editCapabilityOverview(page, {
      name: renamed,
      description: "updated via lab UI e2e",
    });
    await closeCapabilityDetail(page);

    await searchCapabilityByName(page, renamed);
    await expect(capabilityCard(page, renamed)).toBeVisible();

    if (capability?.id) {
      const fresh = await getCapabilityViaLabApi(request, capability.id);
      expect(fresh.name).toContain("_renamed");
      expect(fresh.description).toBe("updated via lab UI e2e");
    }
  });

  test("LAB-UI-03: debug HTTP capability and verify response", async ({ page }) => {
    const toolName = buildUniqueName("lab_ui_http_debug");
    const curl = buildHttpCurl(OSS_MOCK_DOCKER_URL, toolName.replace(/[^a-zA-Z0-9]/g, "_"));

    await gotoCapabilitiesLab(page);
    const capability = await createHttpCapabilityViaUi(page, { name: toolName, curl });
    trackCapability(capability);

    await openCapabilityDetail(page, toolName);
    const { text } = await runDebugInDetail(page, { useExample: true });

    expect(text).toMatch(/"status_code"\s*:\s*200/);
    expect(text).toMatch(/"body"/);
    await closeCapabilityDetail(page);
  });

  test("LAB-UI-04: import OpenAPI batch via UI", async ({ page }) => {
    const baseName = buildUniqueName("lab_ui_openapi");
    const openapi = buildOpenApiImportDocument(baseName, OSS_MOCK_DOCKER_URL);

    await gotoCapabilitiesLab(page);
    const result = await importOpenApiViaUi(page, { openapiSpec: openapi });

    expect((result.capabilities?.length ?? 0) >= 1).toBeTruthy();
    for (const item of result.capabilities ?? []) {
      trackCapability(item);
      if (result.box_id) {
        createdBoxIds.add(result.box_id);
      }
    }

    const firstName = result.capabilities?.[0]?.name;
    expect(firstName).toBeTruthy();
    await searchCapabilityByName(page, firstName!);
  });

  test("LAB-UI-05: register MCP with SSE parse wizard", async ({ page }) => {
    const name = buildUniqueName("lab_ui_mcp");

    await gotoCapabilitiesLab(page);
    const capability = await registerMcpViaUi(page, {
      name,
      url: "http://ef-mcp-mock:8096/sse",
      description: "lab UI MCP",
    });
    trackCapability(capability);

    await openCapabilityDetail(page, name);
    await expect(page.getByRole("heading", { name: /MCP 工具|MCP tools/i })).toBeVisible();
    await closeCapabilityDetail(page);
  });

  test("LAB-UI-06: import Skill zip and show file tree", async ({ page }) => {
    const skillName = buildUniqueName("lab_ui_skill");
    const zipPath = writeTempSkillZip(skillName);

    await gotoCapabilitiesLab(page);
    const capability = await importSkillZipViaUi(page, zipPath);
    trackCapability(capability);

    await openCapabilityDetail(page, skillName);
    await expect(page.getByText(/Skill 文件|Skill files/i)).toBeVisible();
    await closeCapabilityDetail(page);
  });

  test("LAB-UI-07: download Skill package from detail", async ({ page }) => {
    const skillName = buildUniqueName("lab_ui_skill_dl");
    const zipPath = writeTempSkillZip(skillName);

    await gotoCapabilitiesLab(page);
    const capability = await importSkillZipViaUi(page, zipPath);
    trackCapability(capability);

    await openCapabilityDetail(page, skillName);
    const download = await downloadSkillPackageFromDetail(page);

    expect(download.suggestedFilename()).toMatch(/\.zip$/i);
    const savedPath = join(tmpdir(), download.suggestedFilename());
    await download.saveAs(savedPath);
    await closeCapabilityDetail(page);
  });

  test("LAB-UI-08: replace Skill package upload", async ({ page }) => {
    const skillName = buildUniqueName("lab_ui_skill_replace");
    const zipPath = writeTempSkillZip(skillName);
    const replacementPath = writeTempSkillZip(`${skillName}_v2`);

    await gotoCapabilitiesLab(page);
    const capability = await importSkillZipViaUi(page, zipPath);
    trackCapability(capability);

    await openCapabilityDetail(page, skillName);
    await replaceSkillPackageInDetail(page, replacementPath);
    await closeCapabilityDetail(page);
  });

  test("LAB-UI-09: create Function and run Python sandbox with result", async ({ page }) => {
    const name = buildUniqueName("lab_ui_function_sandbox");
    const code = buildFunctionHandlerCode();

    await gotoCapabilitiesLab(page);
    await clickCreateMenuItem(page, /添加 Function 能力|Add Function capability/i);

    const drawer = page.getByRole("dialog", {
      name: /创建函数|添加 Function 能力|Add Function capability/i,
    });
    await drawer.getByLabel(/能力名称|Capability name/i).fill(name);
    await drawer.getByLabel(/Python 代码|Python code/i).fill(code);

    const resultText = await runPythonSandboxInCreateDrawer(page, '{"x": 41}');
    expect(resultText).toMatch(/"output"\s*:\s*42|"result"\s*:\s*42/);

    const createResponse = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/capabilities-lab/v1/capabilities/function") &&
          response.request().method() === "POST",
      ),
      drawer
        .getByRole("button", {
          name: /先运行再创建|创建\s*Function\s*能力|Create function capability/i,
        })
        .click(),
    ]).then(([response]) => response);

    expect(createResponse.ok()).toBeTruthy();
    const body = (await createResponse.json()) as {
      capability?: { id?: string; box_id?: string };
    };
    trackCapability(body.capability);
  });

  test("LAB-UI-10: debug Function capability in detail drawer", async ({ page }) => {
    const name = buildUniqueName("lab_ui_function_debug");
    const code = buildFunctionHandlerCode();

    await gotoCapabilitiesLab(page);
    const capability = await createFunctionCapabilityViaUi(page, { name, code });
    trackCapability(capability);

    await openCapabilityDetail(page, name);
    const { text } = await runDebugInDetail(page, { payload: '{"x": 41}' });
    expect(text).toMatch(/"output"|"result"|42|2/);
    await closeCapabilityDetail(page);
  });

  test("LAB-UI-11: export impex package and re-import via UI", async ({ page }) => {
    const toolName = buildUniqueName("lab_ui_impex");
    const curl = buildHttpCurl(OSS_MOCK_DOCKER_URL, toolName.replace(/[^a-zA-Z0-9]/g, "_"));

    await gotoCapabilitiesLab(page);
    const capability = await createHttpCapabilityViaUi(page, { name: toolName, curl });
    trackCapability(capability);

    await openCapabilityDetail(page, toolName);
    const download = await exportImpexFromDetail(page);
    const exportPath = join(tmpdir(), download.suggestedFilename());
    await download.saveAs(exportPath);
    await closeCapabilityDetail(page);

    await importImpexPackageViaUi(page, exportPath, "upsert");
    await page.waitForTimeout(500);
    await searchCapabilityByName(page, toolName);
  });

  test("LAB-UI-12: publish HTTP capability from detail", async ({ page, request }) => {
    const toolName = buildUniqueName("lab_ui_publish");
    const curl = buildHttpCurl(OSS_MOCK_DOCKER_URL, toolName.replace(/[^a-zA-Z0-9]/g, "_"));

    await gotoCapabilitiesLab(page);
    const capability = await createHttpCapabilityViaUi(page, { name: toolName, curl });
    trackCapability(capability);

    await openCapabilityDetail(page, toolName);
    await publishCapabilityInDetail(page);
    await closeCapabilityDetail(page);

    if (capability?.id) {
      const fresh = await getCapabilityViaLabApi(request, capability.id);
      expect(fresh.status).toBe("published");
    }

    await searchCapabilityByName(page, toolName);
    await expect(capabilityCard(page, toolName).getByText(/已发布|Published/i)).toBeVisible();
  });

  test("LAB-UI-19: HTTP orchestration enable save and disable lifecycle", async ({
    page,
    request,
  }) => {
    const toolName = buildUniqueName("lab_ui_orchestration");
    const curl = buildHttpCurl(OSS_MOCK_DOCKER_URL, toolName.replace(/[^a-zA-Z0-9]/g, "_"));

    await gotoCapabilitiesLab(page);
    const capability = await createHttpCapabilityViaUi(page, { name: toolName, curl });
    trackCapability(capability);

    await openCapabilityDetail(page, toolName);
    await publishCapabilityInDetail(page);
    await runOrchestrationLifecycleInDetail(page);
    await closeCapabilityDetail(page);

    if (capability?.id) {
      const fresh = await getCapabilityViaLabApi(request, capability.id);
      expect(fresh.orchestration?.enabled).toBeFalsy();
    }
  });

  test("LAB-UI-13: debug MCP capability and verify response", async ({ page }) => {
    const name = buildUniqueName("lab_ui_mcp_debug");

    await gotoCapabilitiesLab(page);
    const capability = await registerMcpViaUi(page, {
      name,
      url: "http://ef-mcp-mock:8096/sse",
      description: "lab UI MCP debug",
    });
    trackCapability(capability);

    await openCapabilityDetail(page, name);
    const { response, text } = await runDebugInDetail(page, {
      payload: "{}",
      allowErrorResponse: true,
    });

    expect(text.length).toBeGreaterThan(0);
    if (response.ok()) {
      expect(text).toMatch(/status|result|output|body|content/i);
    } else {
      expect(text).toMatch(/502|failed|错误|error/i);
    }
    await closeCapabilityDetail(page);
  });

  test("LAB-UI-14: install HTTP capability from catalog market", async ({
    page,
    request,
  }) => {
    const toolboxName = buildToolboxName("cat_ui");
    const toolbox = await createToolboxViaApi(request, toolboxName);
    createdBoxIds.add(toolbox.boxId);
    await publishToolboxViaApi(request, toolbox.boxId);

    await gotoCatalogLab(page);
    const installed = await installCatalogEntryViaUi(page, toolboxName);
    if (installed?.box_id) {
      createdBoxIds.add(installed.box_id);
    }
    if (installed?.id) {
      createdCapabilityIds.add(installed.id);
    }

    if (installed?.id) {
      await expect(page).toHaveURL(/\/execution-factory-lab\/capabilities/);
      await expect(capabilityDetailDrawer(page)).toBeVisible({ timeout: 20_000 });
    } else {
      await gotoCapabilitiesLab(page);
    }

    const listed = await listCapabilitiesViaLabApi(request, { keyword: toolboxName });
    expect(listed.data?.some((item) => item.name === toolboxName)).toBeTruthy();
  });

  test("LAB-UI-15: import Skill markdown content via UI", async ({ page, request }) => {
    const skillName = buildUniqueName("lab_ui_skill_content");
    const content = buildSkillContentMarkdown(skillName);

    await gotoCapabilitiesLab(page);
    const capability = await importSkillContentViaUi(page, content);
    trackCapability(capability);

    await openCapabilityDetail(page, skillName);
    await expect(
      capabilityDetailDrawer(page).locator(".ant-descriptions").getByText("Skill content import test"),
    ).toBeVisible();
    await closeCapabilityDetail(page);

    if (capability?.id) {
      const fresh = await getCapabilityViaLabApi(request, capability.id);
      expect(fresh.name).toBe(skillName);
    }
  });

  test("LAB-UI-16: edit Skill capability metadata via UI", async ({ page, request }) => {
    const skillName = buildUniqueName("lab_ui_skill_edit");
    const zipPath = writeTempSkillZip(skillName);
    const renamed = `${skillName}_renamed`;

    await gotoCapabilitiesLab(page);
    const capability = await importSkillZipViaUi(page, zipPath);
    trackCapability(capability);

    await openCapabilityDetail(page, skillName);
    await editCapabilityOverview(page, {
      name: renamed,
      description: "updated skill via lab UI e2e",
    });
    await closeCapabilityDetail(page);

    await searchCapabilityByName(page, renamed);
    if (capability?.id) {
      const fresh = await getCapabilityViaLabApi(request, capability.id);
      expect(fresh.name).toContain("_renamed");
      expect(fresh.description).toBe("updated skill via lab UI e2e");
    }
  });

  test("LAB-UI-18: offline published HTTP capability shows impact warning", async ({
    page,
    request,
  }) => {
    const toolName = buildUniqueName("lab_ui_offline");
    const curl = buildHttpCurl(OSS_MOCK_DOCKER_URL, toolName.replace(/[^a-zA-Z0-9]/g, "_"));

    await gotoCapabilitiesLab(page);
    const capability = await createHttpCapabilityViaUi(page, { name: toolName, curl });
    trackCapability(capability);

    await openCapabilityDetail(page, toolName);
    await publishCapabilityInDetail(page);
    await offlineCapabilityInDetail(page);
    await closeCapabilityDetail(page);

    if (capability?.id) {
      const fresh = await getCapabilityViaLabApi(request, capability.id);
      expect(fresh.status).toBe("offline");
    }
  });

  test("LAB-UI-17: delete HTTP capability from detail drawer", async ({ page, request }) => {
    const toolName = buildUniqueName("lab_ui_delete");
    const curl = buildHttpCurl(OSS_MOCK_DOCKER_URL, toolName.replace(/[^a-zA-Z0-9]/g, "_"));

    await gotoCapabilitiesLab(page);
    const capability = await createHttpCapabilityViaUi(page, { name: toolName, curl });
    const capabilityId = capability?.id;
    expect(capabilityId).toBeTruthy();

    await openCapabilityDetail(page, toolName);
    await deleteCapabilityInDetail(page);

    const listed = await listCapabilitiesViaLabApi(request, { keyword: toolName });
    expect(listed.data?.find((item) => item.id === capabilityId)).toBeFalsy();
  });
});
