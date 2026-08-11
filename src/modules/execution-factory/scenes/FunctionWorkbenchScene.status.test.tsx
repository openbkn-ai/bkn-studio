/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FunctionWorkbenchScene } from "@/modules/execution-factory/scenes/FunctionWorkbenchScene";
import { executeFunction, inferFunctionSchema } from "@/modules/execution-factory/services/function.service";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { destroy: vi.fn(), error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
    modal: { confirm: vi.fn() },
    runtimeConfig: {
      currentUser: {
        permissions: [
          "execution-factory:tool:create",
          "execution-factory:tool:debug",
          "execution-factory:tool:delete",
          "execution-factory:tool:edit",
          "execution-factory:toolbox:edit",
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

describe("FunctionWorkbenchScene status wiring", () => {
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
  });

  /**
   * The backend creates every tool as disabled while execute permits only enabled tools. Without
   * this step, functions authored here remain unreachable after publication; this is the regression
   * guard for that broken link.
   */
  it("enables a newly created function, because the backend creates tools disabled", async () => {
    render(<FunctionWorkbenchScene boxId="box-1" />);

    // The save button lives in the code-area toolbar and exists only after selecting a function and rendering the editor.
    fireEvent.click(await screen.findByText("common.save", undefined, { timeout: 5_000 }));

    await waitFor(() => {
      expect(createTool).toHaveBeenCalledTimes(1);
    });
    expect(updateToolStatus).toHaveBeenCalledWith("box-1", ["tool-new"], "enabled");
  });

  /**
   * Regression: when createTool succeeds but updateToolStatus fails, restore local status to
   * disabled to match the server. The prior implementation cleared dirty in finally and left the
   * local state enabled while the server stayed disabled, so retries skipped it and publication
   * silently produced a function unreachable by the Agent.
   */
  it("pulls a newly created function back to disabled when the enable call fails", async () => {
    updateToolStatus.mockRejectedValue(new Error("enable boom"));

    render(<FunctionWorkbenchScene boxId="box-1" />);

    fireEvent.click(await screen.findByText("common.save", undefined, { timeout: 5_000 }));

    await waitFor(() => {
      expect(updateToolStatus).toHaveBeenCalledWith("box-1", ["tool-new"], "enabled");
    });

    // After enablement fails, local state must display disabled to match the backend rather than remain enabled.
    await waitFor(() => {
      expect(screen.getByText("executionFactory.workbenchDisabledBanner")).toBeTruthy();
    });
    // Do not create the same function in storage twice.
    expect(createTool).toHaveBeenCalledTimes(1);
  });

  it("marks a disabled function in the rail so it is visible without opening it", async () => {
    listTools.mockResolvedValue({
      items: [{ toolId: "tool-1", name: "off_fn", status: "disabled" }],
      total: 1,
      page: 1,
      pageSize: 50,
      boxId: "box-1",
    });
    getToolDetail.mockResolvedValue({
      toolId: "tool-1",
      name: "off_fn",
      description: "desc",
      status: "disabled",
      functionInput: { code: "def handler(event):\n    return event\n", inputs: [], outputs: [] },
    });

    render(<FunctionWorkbenchScene boxId="box-1" />);

    await waitFor(() => {
      expect(screen.getAllByText("off_fn").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("executionFactory.toolStatuses.disabled").length).toBeGreaterThan(0);
    expect(screen.getByText("executionFactory.workbenchDisabledBanner")).toBeTruthy();
  });

  /**
   * Regression: the previous function declared numbers, but the current code becomes zero-argument
   * and infer-schema omits inputs. Running must rebuild test inputs for the latest contract instead
   * of sending the old {"numbers":0}. The old implementation rebuilt only an empty input field,
   * leaving stale inputs and causing the UI to show correct output with pre-edit arguments.
   */
  it("runs with a freshly regenerated event after the declared params change, not the stale auto-filled body", async () => {
    listTools.mockResolvedValue({
      items: [{ toolId: "tool-1", name: "delete_all_files", status: "enabled" }],
      total: 1,
      page: 1,
      pageSize: 50,
      boxId: "box-1",
    });
    getToolDetail.mockResolvedValue({
      toolId: "tool-1",
      name: "delete_all_files",
      description: "desc",
      status: "enabled",
      functionInput: {
        code: 'def delete_all_files():\n    return {"success": False}\n',
        inputs: [{ name: "numbers", type: "integer" }],
        outputs: [],
      },
    });
    // Supported zero-argument inference omits inputs, producing undefined. Before the fix, the
    // `inferred.inputs ?` guard in patchActive skipped undefined and left active.inputs on old numbers.
    vi.mocked(inferFunctionSchema).mockResolvedValue({ supported: true });
    vi.mocked(executeFunction).mockResolvedValue({ output: { success: false }, stdout: "", stderr: "" });

    render(<FunctionWorkbenchScene boxId="box-1" />);

    await waitFor(() => {
      expect(screen.getAllByText("delete_all_files").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByText("executionFactory.workbenchRun"));

    await waitFor(() => {
      expect(executeFunction).toHaveBeenCalledTimes(1);
    });
    expect(inferFunctionSchema).toHaveBeenCalledTimes(1);
    const runArg = vi.mocked(executeFunction).mock.calls[0][0];
    expect(runArg.event).toEqual({});
    expect(runArg.event).not.toHaveProperty("numbers");

    // After running, regenerating from parameters uses active.inputs. It produces "{}" only when
    // derive actually sets active.inputs to []; otherwise old numbers restore {"numbers":0}. This
    // assertion protects the patchActive fix.
    fireEvent.click(screen.getByText("executionFactory.workbenchEventFill"));

    await waitFor(() => {
      expect(screen.queryByDisplayValue(/numbers/)).toBeNull();
    });
    expect(screen.getByDisplayValue("{}")).toBeTruthy();
  });

  /**
   * Regression: the sandbox base image includes no third-party libraries, so dependencies must be
   * sent with this execution. The old implementation sent only code/event/timeout, making debug
   * runs for functions with declared packages fail with ModuleNotFoundError while the published
   * Agent path installed stored dependencies and worked, misleading users into blaming their code.
   */
  it("sends the declared pip dependencies along with the debug run", async () => {
    listTools.mockResolvedValue({
      items: [{ toolId: "tool-1", name: "fetch_fn", status: "enabled" }],
      total: 1,
      page: 1,
      pageSize: 50,
      boxId: "box-1",
    });
    getToolDetail.mockResolvedValue({
      toolId: "tool-1",
      name: "fetch_fn",
      description: "desc",
      status: "enabled",
      functionInput: {
        code: "import requests\n\ndef handler(event):\n    return {}\n",
        dependencies: [{ name: "requests", version: "2.31.0" }],
        inputs: [],
        outputs: [],
      },
    });
    vi.mocked(inferFunctionSchema).mockResolvedValue({ supported: true });
    vi.mocked(executeFunction).mockResolvedValue({ output: {}, stdout: "", stderr: "" });

    render(<FunctionWorkbenchScene boxId="box-1" />);

    await waitFor(() => {
      expect(screen.getAllByText("fetch_fn").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByText("executionFactory.workbenchRun"));

    await waitFor(() => {
      expect(executeFunction).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(executeFunction).mock.calls[0][0].dependencies).toEqual([
      { name: "requests", version: "2.31.0" },
    ]);
  });
});
