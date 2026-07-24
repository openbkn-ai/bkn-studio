/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

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
  gotoE2ePage,
  gotoUnitsTab,
  openAddCapabilityWizard,
  openAdvancedOperatorTab,
  openCardMenu,
  openCreateWizard,
  UNITS_PAGE_TITLE,
  openDetailDrawerByCardClick,
  openDetailPageByCardClick,
  openImportModal,
  openOperatorCreateForm,
  openToolboxToolsPageFromCardMenu,
  gotoSkillDetailPage,
  selectSkillFileInDetailPage,
  selectOperatorCreateMode,
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
      await gotoUnitsTab(page, "toolbox");
      await expect(
        page.getByRole("heading", { level: 2, name: /能力管理|执行能力管理|执行单元管理|Capability Management|Execution Capabilities|Execution Unit Management/i }),
      ).toBeVisible();
      await expect(
        page
          .getByText(
            /为智能体配置可调用的能力|Configure what agents can call|工具集接入 HTTP|MCP 服务连接|Skill 包导入/i,
          )
          .first(),
      ).toBeVisible();
      await expect(
        page
          .getByText(
            /先选择上方类型|Pick a type above|添加能力|Add Capability|系统内置|System built-in/i,
          )
          .first(),
      ).toBeVisible();
    });

    test("UI-COV-002: catalog page shares management list shell and market intro", async ({ page }) => {
      await gotoE2ePage(page, "/execution-factory/catalog?activeTab=toolbox");
      await expect(page.getByRole("heading", { level: 2, name: /能力市场|全部执行单元|Capability Market|All Execution Units/i })).toBeVisible();
      await expect(page.getByRole("tab", { name: /工具集|Toolsets/i })).toBeVisible();
      await expect(page.getByText(/类型|Type/i).first()).toBeVisible();
      await expect(
        page
          .getByText(
            /与能力管理相同的列表视图|与执行能力管理相同的列表视图|Same list view as Capability Management|Same list view as Execution Capabilities|浏览其他业务域已发布|Browse capability packs published/i,
          )
          .first(),
      ).toBeVisible();
    });

    test("UI-COV-003: category filter on primary capability tabs", async ({ page }) => {
      for (const tab of ["toolbox", "mcp", "skill"] as const) {
        await gotoUnitsTab(page, tab);
        await expect(page.getByText(/类型|Type/i).first()).toBeVisible();
        await expect(page.getByRole("button", { name: /全部分类|All categories/i })).toBeVisible();
      }
    });

    test("UI-COV-004: publish status filter on management tabs", async ({ page }) => {
      for (const tab of ["toolbox", "mcp", "skill"] as const) {
        await gotoUnitsTab(page, tab);
        await expect(page.getByText(/发布状态|Publish status/i).first()).toBeVisible();
        await expect(page.getByText(/全部状态|All statuses/i).first()).toBeVisible();
      }

      await openAdvancedOperatorTab(page);
      await expect(page.getByText(/发布状态|Publish status/i).first()).toBeVisible();
    });

    test("UI-COV-005: search input and result count when list has data", async ({
      page,
      request,
    }) => {
      const operator = await registerOperatorViaApi(request, buildOperatorName("ui_cov_search"));
      createdOperators.push(operator);

      await openAdvancedOperatorTab(page);
      await expect(page.getByPlaceholder(/搜索名称|Search name/i)).toBeVisible();
      await page.getByPlaceholder(/搜索名称|Search name/i).fill(operator.name);
      await expect(page.getByRole("heading", { level: 5, name: operator.name })).toBeVisible();
      await expect(page.getByText(/算子|Operators/i).first()).toBeVisible();
    });

    test("UI-COV-006: audit users render as names instead of raw ids", async ({
      page,
      request,
    }) => {
      const toolbox = await createToolboxViaApi(request, buildToolboxName("ui_cov_user"));
      createdBoxIds.push(toolbox.boxId);
      const uuidText =
        /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

      await gotoUnitsTab(page, "toolbox");
      const card = await executionUnitCard(page, toolbox.name);
      await expect(card.getByText(/Local Admin|admin/i)).toBeVisible();
      await expect(card.getByText(uuidText)).toHaveCount(0);

      await openDetailPageByCardClick(
        page,
        toolbox.name,
        new RegExp(`/execution-factory/toolboxes/${toolbox.boxId}/tools`),
      );
      await expect(page.getByText(/创建人\s*Local Admin|Created By\s*Local Admin/i)).toBeVisible();
      await expect(page.getByText(/更新人\s*Local Admin|Updated By\s*Local Admin/i)).toBeVisible();
    });
  });

  test.describe("Create wizard", () => {
    test("UI-COV-010: mcp tab wizard opens mcp configure directly", async ({ page }) => {
      const drawer = await openAddCapabilityWizard(page, "mcp");
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
      await selectOperatorCreateMode(page, "function", drawer);

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
      await gotoE2ePage(page, "/execution-factory/units/new?metadataType=openapi");
      await expect(page.getByRole("link", { name: /基本信息|Basic/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /^OpenAPI$/ })).toBeVisible();
      await expect(page.getByRole("link", { name: /执行控制|Execute/i })).toBeVisible();
      await expectOpenApiInputModes(page);
    });

    test("UI-COV-014: import modal opens on operator, toolbox, and mcp tabs", async ({ page }) => {
      for (const tab of ["operator", "toolbox", "mcp"] as const) {
        await gotoUnitsTab(page, tab);
        const dialog = await openImportModal(page);
        await expect(dialog.getByRole("tab", { name: /备份文件|Backup file/i })).toBeVisible();
        await closeImportOrOverlay(page);
      }
    });
  });

  test.describe("Detail drawers & card menus", () => {
    test("UI-COV-020: toolbox card click lands on the tools page directly", async ({
      page,
      request,
    }) => {
      const toolbox = await createToolboxViaApi(request, buildToolboxName("ui_cov_tb"));
      createdBoxIds.push(toolbox.boxId);

      await gotoUnitsTab(page, "toolbox");
      await openDetailPageByCardClick(
        page,
        toolbox.name,
        new RegExp(`/execution-factory/toolboxes/${toolbox.boxId}/tools`),
      );
      // 抽屉里独有的基础信息现在挂在页面上。
      await expect(page.getByText(toolbox.boxId)).toBeVisible();
    });

    test("UI-COV-021: operator detail drawer shows edit and debug actions", async ({
      page,
      request,
    }) => {
      const operator = await registerOperatorViaApi(request, buildOperatorName("ui_cov_detail"));
      createdOperators.push(operator);

      await openAdvancedOperatorTab(page);
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

      await openAdvancedOperatorTab(page);
      await openCardMenu(page, operator.name, /编辑|Edit/i);
      await expect(page).toHaveURL(new RegExp(`/execution-factory/units/${operator.operatorId}/edit`));
      await expect(page.getByLabel(/算子名称|Operator Name/i)).toHaveValue(operator.name);
    });

    test("UI-COV-023: operator publish from card menu updates tag", async ({ page, request }) => {
      const operator = await registerOperatorViaApi(request, buildOperatorName("ui_cov_pub"));
      createdOperators.push(operator);

      await openAdvancedOperatorTab(page);
      await openCardMenu(page, operator.name, /^发布$|^Publish$/i);
      await confirmAntModal(page);
      await expect(page.getByText(/成功|success/i).first()).toBeVisible({ timeout: 30_000 });

      const card = executionUnitCard(page, operator.name);
      await expect(card.locator(".ant-tag").filter({ hasText: /已发布|Published/i })).toBeVisible();
    });

    test("UI-COV-024: mcp card click opens detail with view detail CTA", async ({ page, request }) => {
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
      await openDetailPageByCardClick(
        page,
        mcp.name,
        new RegExp(`/execution-factory/mcp/${mcp.mcpId}`),
      );
      await expect(page.getByText(mcp.mcpId)).toBeVisible();

      await gotoUnitsTab(page, "mcp");
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

    test("UI-COV-027: skill card click lands on the detail page directly", async ({ page, request }) => {
      const skill = await registerSkillZipViaApi(request, buildSkillName("ui_cov_detail"));
      createdSkillIds.push(skill.skillId);

      await gotoUnitsTab(page, "skill");
      await openDetailPageByCardClick(
        page,
        skill.name,
        new RegExp(`/execution-factory/skills/${skill.skillId}`),
      );
      await expect(page.getByRole("button", { name: /发布历史|Release history/i })).toBeVisible();
    });

    test("UI-COV-028: skill detail page previews package files", async ({ page, request }) => {
      const skill = await registerSkillZipViaApi(request, buildSkillName("ui_cov_preview"));
      createdSkillIds.push(skill.skillId);

      await gotoSkillDetailPage(page, skill.skillId, skill.name);
      await expect(page.getByText(/Zip-packaged skill body|E2E|skill body/i).first()).toBeVisible({
        timeout: 45_000,
      });

      await selectSkillFileInDetailPage(page, "refs/guide.md");
      await expect(page.locator('[class*="ioPanel"] pre')).toContainText("# Guide", {
        timeout: 45_000,
      });
    });
  });

  test.describe("Routes & navigation", () => {
    test("UI-COV-030a: legacy toolboxes/new redirects with create deep link", async ({ page }) => {
      await gotoE2ePage(page, "/execution-factory/toolboxes/new");
      await expect(page).toHaveURL(/activeTab=toolbox/);
      await expect(page).toHaveURL(/create=1/);
      await page.keyboard.press("Escape");
    });

    test("UI-COV-030b: legacy mcp/new redirects with create deep link", async ({ page }) => {
      await gotoE2ePage(page, "/execution-factory/mcp/new");
      await expect(page).toHaveURL(/activeTab=mcp/);
      await expect(page).toHaveURL(/create=1/);
      await page.keyboard.press("Escape");
    });

    test("UI-COV-030c: legacy mcp list redirects to units tab", async ({ page }) => {
      await gotoE2ePage(page, "/execution-factory/mcp");
      await expect(page).toHaveURL(/activeTab=mcp/);
    });

    test("UI-COV-031: toolbox tools page shows breadcrumb trail", async ({ page, request }) => {
      const toolbox = await createToolboxViaApi(request, buildToolboxName("ui_cov_bc"));
      createdBoxIds.push(toolbox.boxId);

      await gotoE2ePage(page, `/execution-factory/toolboxes/${toolbox.boxId}/tools`);
      await expect(page.getByRole("heading", { level: 3, name: toolbox.name })).toBeVisible();

      const breadcrumb = page.getByRole("navigation");
      await expect(breadcrumb.getByText(UNITS_PAGE_TITLE)).toBeVisible();
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

    test("UI-COV-041: toolbox detail view tools from card menu view path", async ({
      page,
      request,
    }) => {
      const toolbox = await createToolboxViaApi(request, buildToolboxName("ui_cov_manage"));
      createdBoxIds.push(toolbox.boxId);

      await gotoUnitsTab(page, "toolbox");
      await openToolboxToolsPageFromCardMenu(page, toolbox.name);
      await expect(page).toHaveURL(new RegExp(`/toolboxes/${toolbox.boxId}/tools`));
    });
  });
});
