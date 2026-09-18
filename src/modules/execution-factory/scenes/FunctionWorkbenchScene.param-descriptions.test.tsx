/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FunctionWorkbenchScene } from "@/modules/execution-factory/scenes/FunctionWorkbenchScene";
import { inferFunctionSchema } from "@/modules/execution-factory/services/function.service";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("react-router-dom", () => ({
  useLocation: () => ({ state: null }),
  useNavigate: () => vi.fn(),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: {
      destroy: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
    },
    modal: { confirm: vi.fn() },
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
  }),
}));

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

const { getResourceOperations } = vi.hoisted(() => ({
  getResourceOperations: vi.fn(),
}));

vi.mock("@/modules/model-resources/services/authorization.service", () => ({
  getResourceOperations,
}));

vi.mock("@/modules/execution-factory/services/category.service", () => ({
  listOperatorCategories: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/modules/execution-factory/services/function.service", () => ({
  executeFunction: vi.fn(),
  inferFunctionSchema: vi.fn(),
}));

const { getToolbox, updateToolbox, updateToolboxStatus } = vi.hoisted(() => ({
  getToolbox: vi.fn(),
  updateToolbox: vi.fn(),
  updateToolboxStatus: vi.fn(),
}));

vi.mock("@/modules/execution-factory/services/toolbox.service", () => ({
  getToolbox,
  updateToolbox,
  updateToolboxStatus,
}));

const { createTool, deleteTools, getToolDetail, listTools, updateTool, updateToolStatus } =
  vi.hoisted(() => ({
    createTool: vi.fn(),
    deleteTools: vi.fn(),
    getToolDetail: vi.fn(),
    listTools: vi.fn(),
    updateTool: vi.fn(),
    updateToolStatus: vi.fn(),
  }));

vi.mock("@/modules/execution-factory/services/tool.service", () => ({
  createTool,
  deleteTools,
  getToolDetail,
  listTools,
  updateTool,
  updateToolStatus,
}));

/** The params toolbar button also carries a count badge, so find it through its label. */
function paramsButton(): HTMLElement {
  const label = screen
    .getAllByText("executionFactory.workbenchParamsTab")
    .find((element) => element.closest("button"));
  const button = label?.closest("button");
  if (!button) {
    throw new Error("params button not rendered");
  }
  return button;
}

/**
 * Regression for bkn-foundry#1613: infer-schema returns only name/type/required, and replacing the
 * inputs with its result erased the saved parameter descriptions and flagged the function dirty,
 * so the next save persisted the blanks.
 */
describe("FunctionWorkbenchScene parameter descriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getToolbox.mockResolvedValue({
      boxId: "box-1",
      name: "测试",
      metadataType: "function",
      status: "unpublish",
    });
    listTools.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50, boxId: "box-1" });
    createTool.mockResolvedValue({ successIds: ["tool-new"], failures: [] });
    updateToolStatus.mockResolvedValue(undefined);
    getResourceOperations.mockResolvedValue([{ id: "adhoc", operation: ["execute"] }]);
  });

  it("keeps saved descriptions and stays clean when a reopened function's params are opened", async () => {
    listTools.mockResolvedValue({
      items: [{ toolId: "tool-1", name: "margin", status: "enabled" }],
      total: 1,
      page: 1,
      pageSize: 50,
      boxId: "box-1",
    });
    getToolDetail.mockResolvedValue({
      toolId: "tool-1",
      name: "margin",
      description: "毛利",
      status: "enabled",
      functionInput: {
        code: "def handler(price: float, cost_price: float):\n    return price - cost_price\n",
        // Stored sorted by name, as the backend returns them; inference follows the signature.
        inputs: [
          { description: "成本价", name: "cost_price", required: true, type: "number" },
          { description: "销售价", name: "price", required: true, type: "number" },
        ],
        outputs: [],
      },
    });
    vi.mocked(inferFunctionSchema).mockResolvedValue({
      supported: true,
      inputs: [
        { name: "price", type: "number", required: true },
        { name: "cost_price", type: "number", required: true },
      ],
    });

    render(<FunctionWorkbenchScene boxId="box-1" />);

    await waitFor(() => {
      expect(screen.getAllByText("margin").length).toBeGreaterThan(0);
    });

    fireEvent.click(paramsButton());

    await waitFor(() => {
      expect(inferFunctionSchema).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByDisplayValue("销售价")).toBeTruthy();
    });
    expect(screen.getByDisplayValue("成本价")).toBeTruthy();
    expect(screen.queryByText("executionFactory.workbenchDirty")).toBeNull();
  });

  it("does not infer again after saving a new function under its server id", async () => {
    vi.mocked(inferFunctionSchema).mockResolvedValue({
      supported: true,
      inputs: [{ name: "price", type: "number", required: true }],
    });

    render(<FunctionWorkbenchScene boxId="box-1" />);

    await screen.findByText("common.save", undefined, { timeout: 5_000 });
    fireEvent.click(paramsButton());

    await waitFor(() => {
      expect(inferFunctionSchema).toHaveBeenCalledTimes(1);
    });
    const description = await screen.findByPlaceholderText(
      "executionFactory.parameterDescriptionPlaceholder",
    );
    fireEvent.change(description, { target: { value: "销售价" } });

    fireEvent.click(screen.getByText("common.save"));

    await waitFor(() => {
      expect(updateToolStatus).toHaveBeenCalledWith("box-1", ["tool-new"], "enabled");
    });
    const [, created] = createTool.mock.calls[0] as [
      string,
      { functionInput?: { inputs?: unknown } },
    ];
    expect(created.functionInput?.inputs).toEqual([
      { description: "销售价", name: "price", required: true, type: "number" },
    ]);

    fireEvent.click(paramsButton());

    await waitFor(() => {
      expect(screen.getByDisplayValue("销售价")).toBeTruthy();
    });
    expect(inferFunctionSchema).toHaveBeenCalledTimes(1);
  });
});
