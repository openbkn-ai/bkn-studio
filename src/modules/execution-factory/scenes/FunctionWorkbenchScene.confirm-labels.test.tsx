/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ModalFuncProps } from "antd";
import { beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import { FunctionWorkbenchScene } from "@/modules/execution-factory/scenes/FunctionWorkbenchScene";

const router = vi.hoisted(() => ({
  location: { state: null as { returnTo?: string } | null },
  navigate: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useLocation: () => router.location,
  useNavigate: () => router.navigate,
}));

const services = vi.hoisted(() => ({
  message: { destroy: vi.fn(), error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
  modal: { confirm: vi.fn<(config: ModalFuncProps) => void>() },
  runtimeConfig: {
    currentUser: {
      permissions: [
        "execution-factory:tool:create",
        "execution-factory:tool:debug",
        "execution-factory:tool:delete",
        "execution-factory:tool:edit",
        "execution-factory:toolbox:edit",
        "execution-factory:function:edit",
        "execution-factory:function:debug",
      ],
    },
  },
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => services,
}));

// Only the function rail, the bulk bar, and the confirmation they open are under test.
vi.mock("@/modules/execution-factory/components/CodeEditor", () => ({
  CodeEditor: ({ value }: { value?: string }) => <textarea readOnly value={value ?? ""} />,
}));
vi.mock("@/modules/execution-factory/components/FunctionAiGenerateModal", () => ({
  FunctionAiGenerateModal: () => null,
}));
vi.mock("@/modules/execution-factory/scenes/function-workbench/FunctionDependencyPanel", () => ({
  FunctionDependencyPanel: () => null,
}));
vi.mock("@/modules/model-resources/services/llm.service", () => ({
  listLlmModels: vi.fn().mockResolvedValue({ items: [] }),
}));
vi.mock("@/modules/execution-factory/services/category.service", () => ({
  listOperatorCategories: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/modules/execution-factory/services/function.service", () => ({
  executeFunction: vi.fn(),
  inferFunctionSchema: vi.fn(),
}));

const api = vi.hoisted(() => ({
  createTool: vi.fn(),
  deleteTools: vi.fn(),
  getToolDetail: vi.fn(),
  getToolbox: vi.fn(),
  listTools: vi.fn(),
  updateTool: vi.fn(),
  updateToolStatus: vi.fn(),
  updateToolbox: vi.fn(),
  updateToolboxStatus: vi.fn(),
}));

vi.mock("@/modules/execution-factory/services/toolbox.service", () => ({
  getToolbox: api.getToolbox,
  updateToolbox: api.updateToolbox,
  updateToolboxStatus: api.updateToolboxStatus,
}));
vi.mock("@/modules/execution-factory/services/tool.service", () => ({
  createTool: api.createTool,
  deleteTools: api.deleteTools,
  getToolDetail: api.getToolDetail,
  listTools: api.listTools,
  updateTool: api.updateTool,
  updateToolStatus: api.updateToolStatus,
}));

const FUNCTIONS = [
  { description: "desc", name: "sum_orders", status: "enabled", toolId: "tool-1" },
  { description: "desc", name: "rank_customers", status: "disabled", toolId: "tool-2" },
];

const LABELS = {
  "en-US": { cancel: "Cancel", disable: "Disable", enable: "Enable", save: "Save" },
  "zh-CN": { cancel: "取消", disable: "禁用", enable: "启用", save: "保存" },
} as const;

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

describe("FunctionWorkbenchScene function status confirmation labels (#491)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    router.location = { state: null };
    services.runtimeConfig.currentUser.permissions = [
      "execution-factory:tool:create",
      "execution-factory:tool:debug",
      "execution-factory:tool:delete",
      "execution-factory:tool:edit",
      "execution-factory:toolbox:edit",
      "execution-factory:function:edit",
      "execution-factory:function:debug",
    ];
    api.getToolbox.mockResolvedValue({
      boxId: "box-1",
      metadataType: "function",
      name: "Orders",
      status: "unpublish",
    });
    api.listTools.mockResolvedValue({
      boxId: "box-1",
      items: FUNCTIONS,
      page: 1,
      pageSize: 50,
      total: FUNCTIONS.length,
    });
    api.getToolDetail.mockImplementation((_boxId: string, toolId: string) => {
      const item = FUNCTIONS.find((candidate) => candidate.toolId === toolId);
      return Promise.resolve({
        ...item,
        functionInput: { code: "def handler(event):\n    return event\n", inputs: [], outputs: [] },
      });
    });
  });

  it("does not expose function mutations to a view-only user", async () => {
    services.runtimeConfig.currentUser.permissions = ["execution-factory:function:view"];

    render(<FunctionWorkbenchScene boxId="box-1" />);

    await railItem("sum_orders");
    expect(screen.queryByRole("button", { name: "executionFactory.cardMenu.more" })).toBeNull();
    expect(screen.queryByText(i18n.t("common.save"))).toBeNull();
    expect(api.deleteTools).not.toHaveBeenCalled();
  });

  it("does not create an unsaved draft for a view-only user opening an empty toolbox", async () => {
    services.runtimeConfig.currentUser.permissions = ["execution-factory:function:view"];
    api.listTools.mockResolvedValue({ boxId: "box-1", items: [], page: 1, pageSize: 50, total: 0 });
    const addEventListener = vi.spyOn(window, "addEventListener");

    render(<FunctionWorkbenchScene boxId="box-1" />);

    await waitFor(() => expect(api.listTools).toHaveBeenCalled());
    expect(addEventListener.mock.calls.some(([type]) => type === "beforeunload")).toBe(false);
    addEventListener.mockRestore();
  });

  it("opens the linked Function and returns to its knowledge-network capability list", async () => {
    services.runtimeConfig.currentUser.permissions = ["execution-factory:function:view"];
    router.location = { state: { returnTo: "/knowledge-network/kn-1/capabilities?kind=function" } };

    render(<FunctionWorkbenchScene boxId="box-1" targetToolId="tool-2" />);

    const selected = await screen.findByRole("option", { name: /rank_customers/ });
    expect(selected).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.click(screen.getByLabelText(/返回|Back/));
    expect(router.navigate).toHaveBeenCalledWith(
      "/knowledge-network/kn-1/capabilities?kind=function",
      { replace: true },
    );
  });

  it("loads a linked Function even when it is outside the first workbench rail page", async () => {
    api.listTools.mockResolvedValue({
      boxId: "box-1",
      items: FUNCTIONS,
      page: 1,
      pageSize: 50,
      total: 51,
    });
    api.getToolDetail.mockImplementation((_boxId: string, toolId: string) =>
      Promise.resolve({
        description: "desc",
        functionInput: { code: "def handler(event):\n    return event\n", inputs: [], outputs: [] },
        name: toolId === "tool-51" ? "late_function" : toolId,
        status: "enabled",
        toolId,
      }),
    );

    render(<FunctionWorkbenchScene boxId="box-1" targetToolId="tool-51" />);

    expect(await screen.findByRole("option", { name: /late_function/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(api.getToolDetail).toHaveBeenCalledWith("box-1", "tool-51");
  });

  describe.each(["en-US", "zh-CN"] as const)("in %s", (locale) => {
    const labels = LABELS[locale];

    beforeEach(async () => {
      await i18n.changeLanguage(locale);
    });

    it("names a single function's switch confirmation Disable or Enable instead of Save", async () => {
      render(<FunctionWorkbenchScene boxId="box-1" />);

      fireEvent.click((await railItem("sum_orders")).getByRole("switch"));
      const disable = await confirmedDialog();
      expect(disable.okText).toBe(labels.disable);
      expect(disable.okText).not.toBe(labels.save);
      expect(disable.cancelText).toBe(labels.cancel);

      services.modal.confirm.mockClear();
      fireEvent.click((await railItem("rank_customers")).getByRole("switch"));
      const enable = await confirmedDialog();
      expect(enable.okText).toBe(labels.enable);
      expect(enable.okText).not.toBe(labels.save);
      expect(enable.cancelText).toBe(labels.cancel);
    });

    it("names the bulk confirmation after the bulk action instead of Save", async () => {
      render(<FunctionWorkbenchScene boxId="box-1" />);

      fireEvent.click((await railItem("sum_orders")).getByRole("checkbox"));
      fireEvent.click((await railItem("rank_customers")).getByRole("checkbox"));

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
