import { expect, test } from "@playwright/test";

import { assertBackendReady } from "../../helpers/common";
import {
  advanceCreateWizardToDetails,
  closeImportOrOverlay,
  closeTopDrawer,
  confirmAntModal,
  executionUnitCard,
  expectOpenApiInputModes,
  fillFunctionOperatorForm,
  fillOpenApiSpecPaste,
  gotoUnitsTab,
  openCardMenu,
  openCreateWizard,
  openDetailDrawerByCardClick,
  openImportModal,
  openOperatorCreateForm,
  openToolboxDetailDrawer,
  selectWizardResourceType,
} from "../../helpers/execution-unit-ui";
import {
  buildFunctionHandlerCode,
  buildMinimalOpenApiSpec,
  buildOperatorName,
  cleanupOperatorViaApi,
  registerOperatorViaApi,
  type RegisteredOperator,
} from "../../helpers/operator";
import {
  buildMcpName,
  cleanupMcpViaApi,
  createToolImportedMcpViaApi,
} from "../../helpers/mcp";
import {
  buildSkillName,
  cleanupSkillViaApi,
  registerSkillZipViaApi,
} from "../../helpers/skill";
import {
  buildToolboxName,
  cleanupToolboxViaApi,
  createToolViaApi,
  createToolboxViaApi,
} from "../../helpers/toolbox";

test.describe("Execution Factory — UI comprehensive coverage", () => {
  let backendReady = false;
  const createdOperators: RegisteredOperator[] = [];
  const createdBoxIds: string[] = [];
  const createdMcpIds: string[] = [];
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

    while (createdMcpIds.length > 0) {
      const mcpId = createdMcpIds.pop();
      if (!mcpId) continue;
      try {
        await cleanupMcpViaApi(request, mcpId);
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

  test.describe("List shell & filters", () => {
    test("UI-COV-001: units page shows pageIntro and toolbar hint", async ({ page }) => {
      await gotoUnitsTab(page, "operator");
      await expect(page.getByRole("heading", { level: 2, name: /执行单元管理|Execution Unit Management/i })).toBeVisible();
      await expect(
        page.getByText(/在本业务域注册和管理 MCP|Register and manage MCP/i).first(),
      ).toBeVisible();
      await expect(
        page.getByText(/管理本业务域已注册的执行资源|Manage execution resources/i).first(),
      ).toBeVisible();
    });

    test("UI-COV-002: catalog page shows market-specific intro", async ({ page }) => {
      await page.goto("/execution-factory/catalog?activeTab=operator");
      await expect(page.getByRole("heading", { level: 2, name: /全部执行单元|All Execution Units/i })).toBeVisible();
      await expect(
        page.getByText(/浏览市场中已发布的执行单元|Browse published execution units/i).first(),
      ).toBeVisible();
    });

    test("UI-COV-003: category filter only on operator tab", async ({ page }) => {
      await gotoUnitsTab(page, "operator");
      await expect(page.getByText(/类型|Type/i).first()).toBeVisible();
      await expect(page.getByRole("button", { name: /全部分类|All categories/i })).toBeVisible();

      await page.getByRole("tab", { name: "工具" }).click();
      await expect(page.getByRole("button", { name: /全部分类|All categories/i })).toHaveCount(0);
    });

    test("UI-COV-004: publish status filter on management tabs", async ({ page }) => {
      await gotoUnitsTab(page, "operator");
      await expect(page.getByText(/发布状态|Publish status/i).first()).toBeVisible();
      await expect(page.getByText(/全部状态|All statuses/i).first()).toBeVisible();
    });

    test("UI-COV-005: search input and result count when list has data", async ({
      page,
      request,
    }) => {
      const operator = await registerOperatorViaApi(request, buildOperatorName("ui_cov_search"));
      createdOperators.push(operator);

      await gotoUnitsTab(page, "operator");
      await expect(page.getByPlaceholder(/搜索名称|Search name/i)).toBeVisible();
      await page.getByPlaceholder(/搜索名称|Search name/i).fill(operator.name);
      await expect(page.getByRole("heading", { level: 5, name: operator.name })).toBeVisible();
      await expect(page.getByText(/算子|Operators/i).first()).toBeVisible();
    });
  });

  test.describe("Create wizard", () => {
    test("UI-COV-010: wizard step1 can switch resource type", async ({ page }) => {
      const drawer = await openCreateWizard(page, "operator");
      await selectWizardResourceType(drawer, "mcp");
      await advanceCreateWizardToDetails(page);
      await expect(drawer.getByLabel(/MCP 名称|MCP Name/i)).toBeVisible();
      await page.keyboard.press("Escape");
    });

    test("UI-COV-011: operator step2 excludes flow orchestration option", async ({ page }) => {
      const drawer = await openCreateWizard(page, "operator");
      await advanceCreateWizardToDetails(page);
      await expect(drawer.getByText(/^OpenAPI$/)).toBeVisible();
      await expect(drawer.getByText(/函数计算|Function/i)).toBeVisible();
      await expect(drawer.getByText(/算子编排|Flow/i)).toHaveCount(0);
      await page.keyboard.press("Escape");
    });

    test("UI-COV-012: function operator full UI create via wizard", async ({ page, request }) => {
      const operatorName = buildOperatorName(String(Date.now()));
      const drawer = await openCreateWizard(page, "operator");
      await advanceCreateWizardToDetails(page);
      await drawer.getByText(/函数计算|Function/i).click();
      await expect(page).toHaveURL(/metadataType=function/);

      await fillFunctionOperatorForm(page, operatorName, buildFunctionHandlerCode());
      await page.getByRole("button", { name: /保\s*存|Save/i }).click();
      await expect(page).toHaveURL(/activeTab=operator/);

      const detailDrawer = page.locator(".ant-drawer").first();
      await expect(detailDrawer.getByText(operatorName).first()).toBeVisible();
      await closeTopDrawer(page);
      await expect(executionUnitCard(page, operatorName)).toBeVisible();

      const listResponse = await request.get(
        "/api/agent-operator-integration/v1/operator/info/list?page=1&page_size=20",
        { headers: { "x-business-domain": "bd_public" } },
      );
      if (listResponse.ok()) {
        const body = (await listResponse.json()) as {
          data?: Array<{ operator_id: string; name?: string; version: string }>;
        };
        const matched = body.data?.find((item) => item.name === operatorName);
        if (matched) {
          createdOperators.push({
            operatorId: matched.operator_id,
            version: matched.version,
            name: operatorName,
          });
        }
      }
    });

    test("UI-COV-013: operator form shows anchor navigation and OpenAPI input modes", async ({
      page,
    }) => {
      await page.goto("/execution-factory/units/new?metadataType=openapi");
      await expect(page.getByRole("link", { name: /基本信息|Basic/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /^OpenAPI$/ })).toBeVisible();
      await expect(page.getByRole("link", { name: /执行控制|Execute/i })).toBeVisible();
      await expectOpenApiInputModes(page);
    });

    test("UI-COV-014: import modal opens on operator, toolbox, and mcp tabs", async ({ page }) => {
      for (const tab of ["operator", "toolbox", "mcp"] as const) {
        await gotoUnitsTab(page, tab);
        const dialog = await openImportModal(page);
        await expect(dialog.getByRole("tab", { name: /ADP 包|ADP/i })).toBeVisible();
        await closeImportOrOverlay(page);
      }
    });
  });

  test.describe("Detail drawers & card menus", () => {
    test("UI-COV-020: toolbox card click opens detail with manage tools CTA", async ({
      page,
      request,
    }) => {
      const toolbox = await createToolboxViaApi(request, buildToolboxName("ui_cov_tb"));
      createdBoxIds.push(toolbox.boxId);

      await gotoUnitsTab(page, "toolbox");
      const drawer = await openDetailDrawerByCardClick(page, toolbox.name);
      await expect(drawer.getByText(/工具箱详情|Toolbox Detail/i)).toBeVisible();
      await drawer.getByRole("button", { name: /管理工具|Manage Tools/i }).click();
      await expect(page).toHaveURL(new RegExp(`/execution-factory/toolboxes/${toolbox.boxId}/tools`));
    });

    test("UI-COV-021: operator detail drawer shows edit and debug actions", async ({
      page,
      request,
    }) => {
      const operator = await registerOperatorViaApi(request, buildOperatorName("ui_cov_detail"));
      createdOperators.push(operator);

      await gotoUnitsTab(page, "operator");
      const drawer = await openDetailDrawerByCardClick(page, operator.name);
      await expect(drawer.getByText(/算子详情|Operator Detail/i)).toBeVisible();
      await expect(drawer.getByRole("button", { name: /编\s*辑|Edit/i })).toBeVisible();
      await expect(drawer.getByRole("button", { name: /调\s*试|Debug/i })).toBeVisible();
      await expect(drawer.getByRole("button", { name: /版本历史|Version History/i })).toBeVisible();
    });

    test("UI-COV-022: operator card menu edit navigates to edit form", async ({
      page,
      request,
    }) => {
      const operator = await registerOperatorViaApi(request, buildOperatorName("ui_cov_edit"));
      createdOperators.push(operator);

      await gotoUnitsTab(page, "operator");
      await openCardMenu(page, operator.name, /编辑|Edit/i);
      await expect(page).toHaveURL(new RegExp(`/execution-factory/units/${operator.operatorId}/edit`));
      await expect(page.getByLabel(/算子名称|Operator Name/i)).toHaveValue(operator.name);
    });

    test("UI-COV-023: operator publish from card menu updates tag", async ({ page, request }) => {
      const operator = await registerOperatorViaApi(request, buildOperatorName("ui_cov_pub"));
      createdOperators.push(operator);

      await gotoUnitsTab(page, "operator");
      await openCardMenu(page, operator.name, /^发布$|^Publish$/i);
      await confirmAntModal(page);
      await expect(page.getByText(/成功|success/i).first()).toBeVisible({ timeout: 30_000 });

      const card = executionUnitCard(page, operator.name);
      await expect(card.locator(".ant-tag").filter({ hasText: /已发布|Published/i })).toBeVisible();
    });

    test("UI-COV-024: mcp card click and edit drawer", async ({ page, request }) => {
      const toolbox = await createToolboxViaApi(request, buildToolboxName("ui_cov_mcp_box"));
      createdBoxIds.push(toolbox.boxId);
      const tool = await createToolViaApi(request, toolbox.boxId, buildToolboxName("ui_cov_mcp_tool"));
      const mcp = await createToolImportedMcpViaApi(
        request,
        buildMcpName("ui_cov"),
        toolbox,
        tool,
      );
      createdMcpIds.push(mcp.mcpId);

      await gotoUnitsTab(page, "mcp");
      const drawer = await openDetailDrawerByCardClick(page, mcp.name);
      await expect(drawer.getByText(/MCP 详情|MCP Detail/i)).toBeVisible();
      await closeTopDrawer(page);

      await openCardMenu(page, mcp.name, /编辑|Edit/i);
      await expect(page.locator(".ant-drawer").getByLabel(/MCP 名称|MCP Name/i)).toBeVisible();
    });

    test("UI-COV-025: mcp card menu includes export action", async ({ page, request }) => {
      const toolbox = await createToolboxViaApi(request, buildToolboxName("ui_cov_mcp_exp"));
      createdBoxIds.push(toolbox.boxId);
      const tool = await createToolViaApi(request, toolbox.boxId, buildToolboxName("ui_cov_tool"));
      const mcp = await createToolImportedMcpViaApi(
        request,
        buildMcpName("ui_cov_exp"),
        toolbox,
        tool,
      );
      createdMcpIds.push(mcp.mcpId);

      await gotoUnitsTab(page, "mcp");
      const card = executionUnitCard(page, mcp.name);
      await card.getByRole("button", { name: /更多操作|More/i }).click();
      await expect(page.getByRole("menuitem", { name: /导出|Export/i })).toBeVisible();
      await page.keyboard.press("Escape");
    });

    test("UI-COV-026: skill card menu shows download and update package", async ({
      page,
      request,
    }) => {
      const skill = await registerSkillZipViaApi(request, buildSkillName("ui_cov"));
      createdSkillIds.push(skill.skillId);

      await gotoUnitsTab(page, "skill");
      const card = executionUnitCard(page, skill.name);
      await card.getByRole("button", { name: /更多操作|More/i }).click();
      await expect(page.getByRole("menuitem", { name: /下载|Download/i })).toBeVisible();
      await expect(page.getByRole("menuitem", { name: /更新包|Update Package/i })).toBeVisible();
      await page.keyboard.press("Escape");
    });

    test("UI-COV-027: skill card click opens detail drawer", async ({ page, request }) => {
      const skill = await registerSkillZipViaApi(request, buildSkillName("ui_cov_detail"));
      createdSkillIds.push(skill.skillId);

      await gotoUnitsTab(page, "skill");
      const drawer = await openDetailDrawerByCardClick(page, skill.name);
      await expect(drawer.getByText(/Skill 详情|Skill Detail/i)).toBeVisible();
    });
  });

  test.describe("Routes & navigation", () => {
    test("UI-COV-030a: legacy toolboxes/new redirects with create deep link", async ({ page }) => {
      await page.goto("/execution-factory/toolboxes/new");
      await expect(page).toHaveURL(/activeTab=toolbox/);
      await expect(page).toHaveURL(/create=1/);
      await page.keyboard.press("Escape");
    });

    test("UI-COV-030b: legacy mcp/new redirects with create deep link", async ({ page }) => {
      await page.goto("/execution-factory/mcp/new");
      await expect(page).toHaveURL(/activeTab=mcp/);
      await expect(page).toHaveURL(/create=1/);
      await page.keyboard.press("Escape");
    });

    test("UI-COV-030c: legacy mcp list redirects to units tab", async ({ page }) => {
      await page.goto("/execution-factory/mcp");
      await expect(page).toHaveURL(/activeTab=mcp/);
    });

    test("UI-COV-031: toolbox tools page shows breadcrumb trail", async ({ page, request }) => {
      const toolbox = await createToolboxViaApi(request, buildToolboxName("ui_cov_bc"));
      createdBoxIds.push(toolbox.boxId);

      await page.goto(`/execution-factory/toolboxes/${toolbox.boxId}/tools`);
      await expect(page.getByRole("heading", { level: 3, name: toolbox.name })).toBeVisible();

      const breadcrumb = page.getByRole("navigation");
      await expect(breadcrumb.getByText(/执行单元管理|Execution Unit Management/i)).toBeVisible();
      await expect(breadcrumb.getByText(toolbox.name)).toBeVisible();
      await expect(breadcrumb.getByText(/工具箱工具|Toolbox Tools/i)).toBeVisible();
    });
  });

  test.describe("End-to-end create paths", () => {
    test("UI-COV-040: openapi operator via wizard matches AT flow", async ({ page, request }) => {
      const operatorName = buildOperatorName(String(Date.now()));
      const openApiSpec = JSON.stringify(buildMinimalOpenApiSpec(operatorName), null, 2);

      await openOperatorCreateForm(page, "openapi");
      await page.getByLabel(/算子名称|Operator Name/i).fill(operatorName);
      await fillOpenApiSpecPaste(page, openApiSpec);
      await page.getByRole("button", { name: /保\s*存|Save/i }).click();

      await expect(page).toHaveURL(/activeTab=operator/);
      await closeTopDrawer(page);
      await expect(executionUnitCard(page, operatorName)).toBeVisible();

      const listResponse = await request.get(
        "/api/agent-operator-integration/v1/operator/info/list?page=1&page_size=20",
        { headers: { "x-business-domain": "bd_public" } },
      );
      if (listResponse.ok()) {
        const body = (await listResponse.json()) as {
          data?: Array<{ operator_id: string; name?: string; version: string }>;
        };
        const matched = body.data?.find((item) => item.name === operatorName);
        if (matched) {
          createdOperators.push({
            operatorId: matched.operator_id,
            version: matched.version,
            name: operatorName,
          });
        }
      }
    });

    test("UI-COV-041: toolbox detail manage tools from card menu view path", async ({
      page,
      request,
    }) => {
      const toolbox = await createToolboxViaApi(request, buildToolboxName("ui_cov_manage"));
      createdBoxIds.push(toolbox.boxId);

      await gotoUnitsTab(page, "toolbox");
      const drawer = await openToolboxDetailDrawer(page, toolbox.name);
      await drawer.getByRole("button", { name: /管理工具|Manage Tools/i }).click();
      await expect(page).toHaveURL(new RegExp(`/toolboxes/${toolbox.boxId}/tools`));
    });
  });
});
