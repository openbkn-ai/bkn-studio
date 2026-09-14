/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ModalFuncProps } from "antd";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import { ExecutionUnitListScene } from "@/modules/execution-factory/scenes/ExecutionUnitListScene";

const services = vi.hoisted(() => ({
  message: { destroy: vi.fn(), error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
  modal: { confirm: vi.fn<(config: ModalFuncProps) => void>() },
  runtimeConfig: {
    currentUser: {
      permissions: [
        "execution-factory:mcp:view",
        "execution-factory:skill:view",
        "execution-factory:toolbox:view",
      ],
    },
  },
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => services,
}));

// A fresh directory per render would re-create the page loader on every render and refetch forever.
const auditUserDirectory = vi.hoisted(() => new Map<string, string>());

vi.mock("@/modules/execution-factory/utils/use-audit-user-directory", () => ({
  useAuditUserDirectory: () => auditUserDirectory,
}));

// Only the card grid and the confirmation it opens are under test.
vi.mock("@/modules/execution-factory/components/create-menu/CreateMenu", () => ({
  CreateMenu: () => null,
}));
vi.mock("@/modules/execution-factory/scenes/ExecutionUnitListOverlays", () => ({
  ExecutionUnitListOverlays: () => null,
}));
vi.mock("@/modules/system-admin/components/ObjectAuthorizeDrawer", () => ({
  ObjectAuthorizeDrawer: () => null,
}));

const api = vi.hoisted(() => ({
  deleteMcp: vi.fn(),
  deleteOperator: vi.fn(),
  deleteSkill: vi.fn(),
  deleteToolbox: vi.fn(),
  downloadComponentExport: vi.fn(),
  downloadSkillPackage: vi.fn(),
  getToolDetail: vi.fn(),
  listMcpMarket: vi.fn(),
  listMcps: vi.fn(),
  listOperatorCategories: vi.fn(),
  listOperatorMarket: vi.fn(),
  listOperators: vi.fn(),
  listSkillMarket: vi.fn(),
  listSkills: vi.fn(),
  listToolboxMarket: vi.fn(),
  listToolboxes: vi.fn(),
  listTools: vi.fn(),
  updateMcpStatus: vi.fn(),
  updateOperatorStatus: vi.fn(),
  updateSkillStatus: vi.fn(),
  updateToolboxStatus: vi.fn(),
}));

vi.mock("@/modules/execution-factory/services/mcp.service", () => ({
  deleteMcp: api.deleteMcp,
  listMcpMarket: api.listMcpMarket,
  listMcps: api.listMcps,
  updateMcpStatus: api.updateMcpStatus,
}));
vi.mock("@/modules/execution-factory/services/operator.service", () => ({
  deleteOperator: api.deleteOperator,
  listOperatorMarket: api.listOperatorMarket,
  listOperators: api.listOperators,
  updateOperatorStatus: api.updateOperatorStatus,
}));
vi.mock("@/modules/execution-factory/services/skill.service", () => ({
  deleteSkill: api.deleteSkill,
  downloadSkillPackage: api.downloadSkillPackage,
  listSkillMarket: api.listSkillMarket,
  listSkills: api.listSkills,
  updateSkillStatus: api.updateSkillStatus,
}));
vi.mock("@/modules/execution-factory/services/toolbox.service", () => ({
  deleteToolbox: api.deleteToolbox,
  listToolboxMarket: api.listToolboxMarket,
  listToolboxes: api.listToolboxes,
  updateToolboxStatus: api.updateToolboxStatus,
}));
vi.mock("@/modules/execution-factory/services/tool.service", () => ({
  getToolDetail: api.getToolDetail,
  listTools: api.listTools,
}));
vi.mock("@/modules/execution-factory/services/impex.service", () => ({
  downloadComponentExport: api.downloadComponentExport,
}));
vi.mock("@/modules/execution-factory/services/category.service", () => ({
  listOperatorCategories: api.listOperatorCategories,
}));

const LOCALES = ["en-US", "zh-CN"] as const;

function renderScene(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/execution-factory/units${search}`]}>
      <ExecutionUnitListScene
        descriptionKey="executionFactory.unitsDescription"
        titleKey="executionFactory.unitsTitle"
        toolbarHintKey="executionFactory.unitsToolbarHint"
      />
    </MemoryRouter>,
  );
}

/** Opens the card's action menu and picks the lifecycle item, the way a user starts the change. */
async function chooseCardAction(cardName: string, actionLabel: string) {
  await screen.findByText(cardName);
  fireEvent.click(screen.getByRole("button", { name: i18n.t("executionFactory.cardMenu.more") }));
  fireEvent.click(within(screen.getByRole("menu")).getByText(actionLabel));
}

async function confirmedDialog() {
  await waitFor(() => expect(services.modal.confirm).toHaveBeenCalledTimes(1));
  return services.modal.confirm.mock.calls[0][0];
}

describe("ExecutionUnitListScene lifecycle confirmation labels (#491)", () => {
  beforeAll(() => {
    // antd's responsive observers subscribe through matchMedia, which jsdom does not provide.
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: query,
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    );
  });

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    api.listOperatorCategories.mockResolvedValue([]);
    api.listOperators.mockResolvedValue({ items: [], total: 0 });
    api.listSkills.mockResolvedValue({ items: [], total: 0 });
    api.listToolboxes.mockResolvedValue({ items: [], total: 0 });
    api.listMcps.mockResolvedValue({ items: [], total: 0 });
  });

  describe.each(LOCALES)("in %s", (locale) => {
    beforeEach(async () => {
      await i18n.changeLanguage(locale);
    });

    it("names the MCP publish confirmation after the action instead of Save", async () => {
      api.listMcps.mockResolvedValue({
        items: [{ mcpId: "mcp-1", name: "Weather MCP", status: "unpublish" }],
        total: 1,
      });

      renderScene("?activeTab=mcp");
      await chooseCardAction("Weather MCP", i18n.t("executionFactory.publish"));

      const dialog = await confirmedDialog();
      expect(dialog.okText).toBe(locale === "en-US" ? "Publish" : "发布");
      expect(dialog.okText).not.toBe(i18n.t("common.save"));
      expect(dialog.cancelText).toBe(locale === "en-US" ? "Cancel" : "取消");
    });

    it("names the MCP unpublish confirmation after the action instead of Save", async () => {
      api.listMcps.mockResolvedValue({
        items: [{ mcpId: "mcp-1", name: "Weather MCP", status: "published" }],
        total: 1,
      });

      renderScene("?activeTab=mcp");
      await chooseCardAction("Weather MCP", i18n.t("executionFactory.offline"));

      const dialog = await confirmedDialog();
      expect(dialog.okText).toBe(locale === "en-US" ? "Unpublish" : "取消发布");
      expect(dialog.okText).not.toBe(i18n.t("common.save"));
      expect(dialog.cancelText).toBe(locale === "en-US" ? "Cancel" : "取消");
    });

    it("names a clean toolbox publish Publish, and keeps Publish anyway when preflight finds issues", async () => {
      api.listToolboxes.mockResolvedValue({
        items: [{ boxId: "box-1", metadataType: "openapi", name: "Weather Toolbox", status: "unpublish" }],
        total: 1,
      });
      api.listTools.mockResolvedValue({
        items: [
          {
            description: "Look up the weather",
            metadataType: "openapi",
            name: "get_weather",
            status: "enabled",
            toolId: "tool-1",
          },
        ],
        total: 1,
      });

      const { unmount } = renderScene("?activeTab=toolbox&toolboxView=openapi");
      await chooseCardAction("Weather Toolbox", i18n.t("executionFactory.publish"));

      const clean = await confirmedDialog();
      expect(clean.okText).toBe(locale === "en-US" ? "Publish" : "发布");

      // An empty toolbox trips preflight; the existing, already accurate override must still win.
      unmount();
      services.modal.confirm.mockClear();
      api.listTools.mockResolvedValue({ items: [], total: 0 });

      renderScene("?activeTab=toolbox&toolboxView=openapi");
      await chooseCardAction("Weather Toolbox", i18n.t("executionFactory.publish"));

      const withIssues = await confirmedDialog();
      expect(withIssues.okText).toBe(locale === "en-US" ? "Publish Anyway" : "仍然发布");
      expect(withIssues.okButtonProps).toEqual({ danger: true });
    });
  });
});
