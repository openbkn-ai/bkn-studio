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
import { ToolboxToolsScene } from "@/modules/execution-factory/scenes/ToolboxToolsScene";

const services = vi.hoisted(() => ({
  message: { destroy: vi.fn(), error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
  modal: { confirm: vi.fn<(config: ModalFuncProps) => void>() },
  runtimeConfig: {
    currentUser: {
      permissions: [
        "execution-factory:tool:create",
        "execution-factory:tool:delete",
        "execution-factory:tool:edit",
        "execution-factory:toolbox:edit",
      ],
    },
  },
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => services,
}));

// Only the tool rail, the bulk bar, and the confirmation they open are under test.
vi.mock("@/modules/execution-factory/components/ToolDebugModal", () => ({
  ToolDebugModal: () => null,
}));
vi.mock("@/modules/execution-factory/components/ToolFormDrawer", () => ({
  ToolFormDrawer: () => null,
}));
vi.mock("@/modules/execution-factory/components/ToolIoPanel", () => ({
  ToolIoPanel: () => null,
}));
vi.mock("@/modules/execution-factory/components/create-menu/AddCapabilityWizard", () => ({
  AddCapabilityWizard: () => null,
}));

const auditUserDirectory = vi.hoisted(() => new Map<string, string>());

vi.mock("@/modules/execution-factory/utils/use-audit-user-directory", () => ({
  useAuditUserDirectory: () => auditUserDirectory,
}));
vi.mock("@/modules/execution-factory/utils/use-impex-export", () => ({
  useImpexExport: () => ({ exportComponentById: vi.fn(), isExporting: () => false }),
}));

const api = vi.hoisted(() => ({
  deleteTools: vi.fn(),
  getToolDetail: vi.fn(),
  getToolbox: vi.fn(),
  getToolboxMarket: vi.fn(),
  listTools: vi.fn(),
  updateTool: vi.fn(),
  updateToolStatus: vi.fn(),
}));

vi.mock("@/modules/execution-factory/services/toolbox.service", () => ({
  getToolbox: api.getToolbox,
  getToolboxMarket: api.getToolboxMarket,
}));
vi.mock("@/modules/execution-factory/services/tool.service", () => ({
  deleteTools: api.deleteTools,
  getToolDetail: api.getToolDetail,
  listTools: api.listTools,
  updateTool: api.updateTool,
  updateToolStatus: api.updateToolStatus,
}));

const TOOLS = [
  { metadataType: "openapi", name: "get_weather", status: "enabled", toolId: "tool-1" },
  { metadataType: "openapi", name: "get_forecast", status: "disabled", toolId: "tool-2" },
];

const LABELS = {
  "en-US": { cancel: "Cancel", disable: "Disable", enable: "Enable", save: "Save" },
  "zh-CN": { cancel: "取消", disable: "禁用", enable: "启用", save: "保存" },
} as const;

function renderScene() {
  return render(
    <MemoryRouter initialEntries={["/execution-factory/toolboxes/box-1/tools"]}>
      <ToolboxToolsScene boxId="box-1" />
    </MemoryRouter>,
  );
}

async function railItem(name: string) {
  return within(await screen.findByRole("option", { name: new RegExp(name) }));
}

/** antd spaces out two-character CJK button labels ("启 用"), so compare names without whitespace. */
function buttonNamed(label: string) {
  return (accessibleName: string) => accessibleName.replace(/\s/g, "") === label;
}

async function confirmedDialog() {
  await waitFor(() => expect(services.modal.confirm).toHaveBeenCalledTimes(1));
  return services.modal.confirm.mock.calls[0][0];
}

describe("ToolboxToolsScene tool status confirmation labels (#491)", () => {
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
    api.getToolbox.mockResolvedValue({
      boxId: "box-1",
      metadataType: "openapi",
      name: "Weather Toolbox",
      status: "unpublish",
    });
    api.listTools.mockResolvedValue({ items: TOOLS, total: TOOLS.length });
    api.getToolDetail.mockImplementation((_boxId: string, toolId: string) =>
      Promise.resolve(TOOLS.find((tool) => tool.toolId === toolId)),
    );
  });

  describe.each(["en-US", "zh-CN"] as const)("in %s", (locale) => {
    const labels = LABELS[locale];

    beforeEach(async () => {
      await i18n.changeLanguage(locale);
    });

    it("names a single tool's switch confirmation Disable or Enable instead of Save", async () => {
      renderScene();

      fireEvent.click((await railItem("get_weather")).getByRole("switch"));
      const disable = await confirmedDialog();
      expect(disable.okText).toBe(labels.disable);
      expect(disable.okText).not.toBe(labels.save);
      expect(disable.cancelText).toBe(labels.cancel);

      services.modal.confirm.mockClear();
      fireEvent.click((await railItem("get_forecast")).getByRole("switch"));
      const enable = await confirmedDialog();
      expect(enable.okText).toBe(labels.enable);
      expect(enable.okText).not.toBe(labels.save);
      expect(enable.cancelText).toBe(labels.cancel);
    });

    it("names the bulk confirmation after the bulk action instead of Save", async () => {
      renderScene();

      fireEvent.click((await railItem("get_weather")).getByRole("checkbox"));
      fireEvent.click((await railItem("get_forecast")).getByRole("checkbox"));

      fireEvent.click(await screen.findByRole("button", { name: buttonNamed(labels.enable) }));
      const enable = await confirmedDialog();
      expect(enable.okText).toBe(labels.enable);
      expect(enable.okText).not.toBe(labels.save);
      expect(enable.cancelText).toBe(labels.cancel);

      services.modal.confirm.mockClear();
      fireEvent.click(screen.getByRole("button", { name: buttonNamed(labels.disable) }));
      const disable = await confirmedDialog();
      expect(disable.okText).toBe(labels.disable);
      expect(disable.okText).not.toBe(labels.save);
      expect(disable.cancelText).toBe(labels.cancel);
    });
  });
});
