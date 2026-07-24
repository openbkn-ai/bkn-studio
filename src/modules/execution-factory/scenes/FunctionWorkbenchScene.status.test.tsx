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
    message: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
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
   * 后端建工具一律落 disabled，而 execute 只放行 enabled。不补这一刀的话，
   * 在这个页面写完的函数发布了也调不到——这是这条断链的回归防线。
   */
  it("enables a newly created function, because the backend creates tools disabled", async () => {
    render(<FunctionWorkbenchScene boxId="box-1" />);

    await waitFor(() => {
      expect(screen.getByText("executionFactory.workbenchFunctionList")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("common.save"));

    await waitFor(() => {
      expect(createTool).toHaveBeenCalledTimes(1);
    });
    expect(updateToolStatus).toHaveBeenCalledWith("box-1", ["tool-new"], "enabled");
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
   * 回归:上个函数留下声明入参 numbers,当前代码换成零参函数(后端 infer-schema 回
   * 的 inputs 缺省 → undefined)。点运行必须按最新契约重造测试入参,而不是拿改前的
   * {"numbers":0} 去跑。旧实现只在入参框为空壳时才重造,非空就原样发,于是执行拿到
   * 的还是改前的旧参——正是页面上「返回值对、入参是改前的」那个 bug。
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
    // supported 的零参推导:后端省略 inputs 字段 → undefined。fix 前 patchActive 的
    // `inferred.inputs ?` 守卫会漏过 undefined,active.inputs 卡在旧的 numbers。
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

    // 运行完再点回入参框:onFocus 见框里是 "{}" 就用 sampleEvent 回填。只有 derive
    // 把 active.inputs 真落成 [] 时 sampleEvent 才是 "{}";否则 active.inputs 卡在旧的
    // numbers,旧参 {"numbers":0} 在这里复活。这一条锁的是 patchActive 那处修复。
    fireEvent.focusIn(screen.getByDisplayValue("{}"));

    await waitFor(() => {
      expect(screen.queryByDisplayValue(/numbers/)).toBeNull();
    });
    expect(screen.getByDisplayValue("{}")).toBeTruthy();
  });
});
