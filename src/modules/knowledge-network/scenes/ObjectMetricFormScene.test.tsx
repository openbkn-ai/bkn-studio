/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ObjectMetricFormScene } from "./ObjectMetricFormScene";
import type {
  ObjectMetricDesignResult,
  RunObjectMetricDesignParams,
} from "@/modules/knowledge-network/services/object-metric-designer.service";
import { createObjectMetricDefinitionV1 } from "@/modules/knowledge-network/components/object-metric/object-metric-model";
import type { ObjectMetricDefinitionV1 } from "@/modules/knowledge-network/types/object-metric";

const mocks = vi.hoisted(() => {
  const routeParams: { current: { metricId?: string; networkId: string } } = {
    current: { metricId: "metric-1", networkId: "network-1" },
  };
  return {
    createObjectMetricDraftV1: vi.fn(),
    trialObjectMetricDataV1: vi.fn(),
    validateObjectMetricV1:
      vi.fn<(networkId: string, definition: ObjectMetricDefinitionV1) => Promise<unknown>>(),
    previewObjectMetricV1: vi.fn(),
    listObjectMetricsV1: vi.fn(),
    runObjectMetricDesigner:
      vi.fn<(params: RunObjectMetricDesignParams) => Promise<ObjectMetricDesignResult>>(),
    listObjectMetricAnswerModels: vi.fn(),
    getKnowledgeNetworkObjectTypeDetail: vi.fn(),
    getObjectMetricV1: vi.fn(),
    locationState: { current: null as { knowledgeNetworkReturnTo?: string } | null },
    message: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
    navigate: vi.fn(),
    routeParams,
    searchParams: { current: "" },
    runtimeConfig: {
      auth: { tokenManager: { getAccessToken: () => null, refreshAccessToken: vi.fn() } },
    },
  };
});

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => mocks.navigate,
  useLocation: () => ({ state: mocks.locationState.current }),
  useParams: () => mocks.routeParams.current,
  useSearchParams: () => [new URLSearchParams(mocks.searchParams.current)],
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: mocks.message,
    runtimeConfig: mocks.runtimeConfig,
  }),
}));

vi.mock(
  "@/modules/knowledge-network/services/knowledge-network.service",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/modules/knowledge-network/services/knowledge-network.service")
    >()),
    createObjectMetricDraftV1: mocks.createObjectMetricDraftV1,
    trialObjectMetricDataV1: mocks.trialObjectMetricDataV1,
    validateObjectMetricV1: mocks.validateObjectMetricV1,
    previewObjectMetricV1: mocks.previewObjectMetricV1,
    getObjectMetricCapabilitiesV1: vi.fn().mockResolvedValue(undefined),
    getObjectMetricV1: mocks.getObjectMetricV1,
    listKnowledgeNetworkObjectTypes: vi.fn().mockResolvedValue([]),
    listKnowledgeNetworkRelationTypes: vi.fn().mockResolvedValue([]),
    listObjectMetricsV1: mocks.listObjectMetricsV1,
  }),
);

vi.mock("@/modules/knowledge-network/services/object-type.service", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/modules/knowledge-network/services/object-type.service")
  >()),
  getKnowledgeNetworkObjectTypeDetail: mocks.getKnowledgeNetworkObjectTypeDetail,
}));

vi.mock("@/modules/knowledge-network/components/object-metric/ObjectMetricTrialDrawer", () => ({
  ObjectMetricTrialDrawer: ({ onRun }: { onRun: (query: object) => Promise<unknown> }) => (
    <button onClick={() => void onRun({}).catch(() => {})} type="button">
      执行模拟试算
    </button>
  ),
}));

vi.mock(
  "@/modules/knowledge-network/services/object-metric-designer.service",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/modules/knowledge-network/services/object-metric-designer.service")
    >()),
    runObjectMetricDesigner: mocks.runObjectMetricDesigner,
  }),
);

vi.mock("@/modules/knowledge-network/services/object-metric-models.service", () => ({
  listObjectMetricAnswerModels: mocks.listObjectMetricAnswerModels,
}));

function mockDesignerName(name: string) {
  mocks.runObjectMetricDesigner.mockImplementation((params) =>
    Promise.resolve({
      answer: "已生成修改建议",
      proposal: {
        kind: "metric_design_proposal",
        base_form_revision: params.baseFormRevision,
        summary: "建议更新对象指标名称",
        questions: [],
        changes: [
          { field: "name", operation: "replace", before: "", after: name, reason: "用户要求" },
        ],
      },
      runId: "run-1",
      threadId: "thread-1",
    }),
  );
}

function getButtonByText(name: string | RegExp) {
  const button = screen.getByText(name).closest("button");
  if (!button) throw new Error(`Expected button: ${String(name)}`);
  return button;
}

async function findButtonByText(name: string | RegExp) {
  const button = (await screen.findByText(name)).closest("button");
  if (!button) throw new Error(`Expected button: ${String(name)}`);
  return button;
}

function queryButtonByText(name: string | RegExp) {
  return screen.queryByText(name)?.closest("button") ?? null;
}

const originalMatchMedia = window.matchMedia;

beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  }));
});

afterAll(() => {
  window.matchMedia = originalMatchMedia;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  mocks.listObjectMetricAnswerModels.mockResolvedValue([{ id: "model-1", name: "测试对话模型" }]);
  mocks.createObjectMetricDraftV1.mockResolvedValue(undefined);
  mocks.listObjectMetricsV1.mockResolvedValue({ entries: [], total_count: 0 });
  mocks.validateObjectMetricV1.mockResolvedValue({
    valid: true,
    issues: [],
    output_shape: "summary",
  });
  mocks.previewObjectMetricV1.mockResolvedValue({
    validation: { valid: true, issues: [], output_shape: "summary" },
    output_schema: {
      shape: "summary",
      dimensions: [],
      value: {
        physical_type: "int64",
        semantic_type: "count",
        unit: { code: "1", quantity_kind: "count", scale_factor: 1, system: "UCUM" },
      },
    },
  });
  mocks.routeParams.current = { metricId: "metric-1", networkId: "network-1" };
  mocks.searchParams.current = "";
  mocks.locationState.current = null;
});

describe("ObjectMetricFormScene object properties", () => {
  it("pins an authorized model to one conversation and keeps the form when starting another", async () => {
    mocks.routeParams.current = { metricId: undefined, networkId: "network-1" };
    mocks.searchParams.current = "objectTypeId=order&metricType=atomic";
    mocks.getKnowledgeNetworkObjectTypeDetail.mockResolvedValue({ dataProperties: [] });
    mockDesignerName("AI 订单数");

    render(<ObjectMetricFormScene mode="create" />);
    await screen.findByText("平台默认模型");
    const modelSelect = document.querySelector<HTMLInputElement>("#metric-ai-model");
    if (!modelSelect) throw new Error("expected model select");
    await waitFor(() => expect(mocks.listObjectMetricAnswerModels).toHaveBeenCalled());
    fireEvent.mouseDown(modelSelect);
    fireEvent.click(await screen.findByText("测试对话模型"));
    fireEvent.change(await screen.findByLabelText("描述要创建的对象指标"), {
      target: { value: "统计订单数" },
    });
    fireEvent.click(screen.getByLabelText("发送对象指标描述"));
    await waitFor(() => expect(mocks.runObjectMetricDesigner).toHaveBeenCalledTimes(1));
    expect(mocks.runObjectMetricDesigner.mock.calls[0][0].modelId).toBe("model-1");
    expect(await screen.findByText("新对话")).toBeInTheDocument();
    expect(modelSelect).toBeDisabled();
    fireEvent.change(screen.getByLabelText("对象指标名称"), {
      target: { value: "人工填写" },
    });
    fireEvent.click(getButtonByText("新对话"));
    expect(modelSelect).not.toBeDisabled();
    expect(screen.getByLabelText("对象指标名称")).toHaveValue("人工填写");
    expect(screen.queryByText("待应用的修改建议")).not.toBeInTheDocument();
  }, 90_000);

  it("opens the AI designer by default on the create page", async () => {
    mocks.routeParams.current = { metricId: undefined, networkId: "network-1" };
    mocks.searchParams.current = "objectTypeId=order&metricType=derived";
    mocks.getKnowledgeNetworkObjectTypeDetail.mockResolvedValue({ dataProperties: [] });

    render(<ObjectMetricFormScene mode="create" />);

    expect(await screen.findByLabelText("AI 生成对象指标")).toBeInTheDocument();
    expect(getButtonByText("AI 生成")).toHaveAttribute("aria-expanded", "true");
  });

  it("requires confirmation and rejects a proposal after the form changes", async () => {
    mocks.routeParams.current = { metricId: undefined, networkId: "network-1" };
    mocks.searchParams.current = "objectTypeId=order&metricType=atomic";
    mocks.getKnowledgeNetworkObjectTypeDetail.mockResolvedValue({ dataProperties: [] });
    mockDesignerName("AI 订单数");

    render(<ObjectMetricFormScene mode="create" />);
    fireEvent.change(await screen.findByLabelText("描述要创建的对象指标"), {
      target: { value: "统计订单数" },
    });
    fireEvent.click(screen.getByLabelText("发送对象指标描述"));
    expect(await screen.findByText("待应用的修改建议")).toBeInTheDocument();
    expect(mocks.runObjectMetricDesigner.mock.lastCall?.[0].scope).toMatchObject({
      kn_id: "network-1",
      owner_object_type_id: "order",
      metric_type: "atomic",
      mode: "create",
    });
    expect(screen.getByText('建议值: "AI 订单数"')).toBeInTheDocument();
    expect(screen.getByLabelText("对象指标名称")).not.toHaveValue("AI 订单数");

    fireEvent.click(getButtonByText("应用所选修改"));
    expect(screen.getByLabelText("对象指标名称")).toHaveValue("AI 订单数");
    expect(screen.queryByText("待应用的修改建议")).not.toBeInTheDocument();
    fireEvent.click(await findButtonByText("撤销本次应用"));
    expect(screen.getByLabelText("对象指标名称")).toHaveValue("");

    fireEvent.change(screen.getByLabelText("描述要创建的对象指标"), {
      target: { value: "再调整一次" },
    });
    fireEvent.click(screen.getByLabelText("发送对象指标描述"));
    expect(await screen.findByText("待应用的修改建议")).toBeInTheDocument();
    expect(mocks.runObjectMetricDesigner).toHaveBeenLastCalledWith(
      expect.objectContaining({ threadId: "thread-1" }),
    );

    fireEvent.change(screen.getByLabelText("对象指标名称"), {
      target: { value: "人工填写" },
    });
    fireEvent.click(getButtonByText("应用所选修改"));
    expect(screen.getByLabelText("对象指标名称")).toHaveValue("人工填写");
    expect(await screen.findByText(/原建议不会覆盖当前编辑/)).toBeInTheDocument();
    expect(screen.queryByText("待应用的修改建议")).not.toBeInTheDocument();
  }, 60_000);

  it("does not undo manual edits made after applying an AI proposal", async () => {
    mocks.routeParams.current = { metricId: undefined, networkId: "network-1" };
    mocks.searchParams.current = "objectTypeId=order&metricType=atomic";
    mocks.getKnowledgeNetworkObjectTypeDetail.mockResolvedValue({ dataProperties: [] });
    mockDesignerName("AI 订单数");

    render(<ObjectMetricFormScene mode="create" />);
    fireEvent.change(await screen.findByLabelText("描述要创建的对象指标"), {
      target: { value: "统计订单数" },
    });
    fireEvent.click(screen.getByLabelText("发送对象指标描述"));
    fireEvent.click(await findButtonByText("应用所选修改"));
    expect(screen.getByLabelText("对象指标名称")).toHaveValue("AI 订单数");

    fireEvent.change(screen.getByLabelText("对象指标名称"), {
      target: { value: "人工确认的订单数" },
    });
    fireEvent.click(await findButtonByText("撤销本次应用"));

    expect(screen.getByLabelText("对象指标名称")).toHaveValue("人工确认的订单数");
    expect(await screen.findByText(/表单已有新的修改，不能自动撤销/)).toBeInTheDocument();
    expect(queryButtonByText("撤销本次应用")).not.toBeInTheDocument();
  }, 60_000);

  it("keeps the editable form available beside the AI assistant", async () => {
    mocks.routeParams.current = { metricId: undefined, networkId: "network-1" };
    mocks.searchParams.current = "objectTypeId=order&metricType=atomic";
    mocks.getKnowledgeNetworkObjectTypeDetail.mockResolvedValue({ dataProperties: [] });

    render(<ObjectMetricFormScene mode="create" />);

    const aiPanel = await screen.findByLabelText("AI 生成对象指标");
    const page = aiPanel.closest("main");
    if (!page) throw new Error("expected metric form page");
    expect(page).toHaveAttribute("data-ai-layout", "docked");
    expect(aiPanel).toBeInTheDocument();
    const scrollContent = screen.getByTestId("metric-ai-scroll-content");
    expect(scrollContent).toHaveTextContent("描述业务口径，我会先给出修改建议；确认后再更新表单。");
    expect(aiPanel).toHaveTextContent("不会自动保存或发布");
    expect(screen.queryByText("验证与试算")).not.toBeInTheDocument();
    expect(scrollContent).not.toContainElement(screen.getByLabelText("描述要创建的对象指标"));
    expect(queryButtonByText("验证当前表单")).not.toBeInTheDocument();
    expect(queryButtonByText("试算当前表单")).not.toBeInTheDocument();
    expect(mocks.validateObjectMetricV1).not.toHaveBeenCalled();
    expect(mocks.trialObjectMetricDataV1).not.toHaveBeenCalled();
    expect(getButtonByText("保存草稿")).toBeVisible();
    fireEvent.click(getButtonByText("统计订单数量"));
    expect(screen.getByLabelText("描述要创建的对象指标")).toHaveValue("统计订单数量");
    expect(mocks.runObjectMetricDesigner).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("对象指标名称"), {
      target: { value: "订单数量" },
    });
    expect(screen.getByLabelText("对象指标名称")).toHaveValue("订单数量");
    fireEvent.change(screen.getByLabelText("描述要创建的对象指标"), {
      target: { value: "统计已确认订单数" },
    });
    fireEvent.click(screen.getByLabelText("全页展开 AI 对话"));
    expect(page).toHaveAttribute("data-ai-layout", "expanded");
    expect(screen.getByLabelText("返回双栏视图")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("描述要创建的对象指标")).toHaveValue("统计已确认订单数");
    fireEvent.click(screen.getByLabelText("返回双栏视图"));
    expect(page).toHaveAttribute("data-ai-layout", "docked");
    expect(screen.getByLabelText("对象指标名称")).toHaveValue("订单数量");
    fireEvent.click(screen.getByLabelText("查看表单"));
    expect(page).toHaveAttribute("data-ai-layout", "closed");
    expect(screen.queryByLabelText("AI 生成对象指标")).not.toBeInTheDocument();
    expect(getButtonByText("保存草稿")).toBeVisible();
  }, 90_000);

  it("validates the unsaved form on an explicit chat request and sends bounded feedback on the next turn", async () => {
    mocks.routeParams.current = { metricId: undefined, networkId: "network-1" };
    mocks.searchParams.current = "objectTypeId=order&metricType=atomic";
    mocks.getKnowledgeNetworkObjectTypeDetail.mockResolvedValue({ dataProperties: [] });
    mockDesignerName("AI 订单数");

    render(<ObjectMetricFormScene mode="create" />);
    fireEvent.change(await screen.findByLabelText("对象指标名称"), {
      target: { value: "订单数" },
    });
    fireEvent.change(screen.getByLabelText("业务定义"), {
      target: { value: "统计当前对象类中的订单数量" },
    });
    expect(mocks.validateObjectMetricV1).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("描述要创建的对象指标"), {
      target: { value: "验证一下当前对象指标定义是否正确" },
    });
    fireEvent.click(screen.getByLabelText("发送对象指标描述"));
    await waitFor(() => expect(mocks.validateObjectMetricV1).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.previewObjectMetricV1).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/定义校验通过，结果契约已预览/)).toBeInTheDocument();
    expect(mocks.runObjectMetricDesigner).not.toHaveBeenCalled();
    expect(mocks.createObjectMetricDraftV1).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("描述要创建的对象指标"), {
      target: { value: "根据校验结果检查口径" },
    });
    fireEvent.click(screen.getByLabelText("发送对象指标描述"));
    await waitFor(() => expect(mocks.runObjectMetricDesigner).toHaveBeenCalledTimes(1));
    const params = mocks.runObjectMetricDesigner.mock.calls[0][0];
    expect(params.diagnostic).toMatchObject({
      kind: "validation",
      status: "valid",
      output_shape: "summary",
      unit_code: "1",
      form_revision: params.baseFormRevision,
    });
    expect(mocks.trialObjectMetricDataV1).not.toHaveBeenCalled();
  }, 30_000);

  it("sends local field errors to the designer without calling the metric validation API", async () => {
    mocks.routeParams.current = { metricId: undefined, networkId: "network-1" };
    mocks.searchParams.current = "objectTypeId=order&metricType=atomic";
    mocks.getKnowledgeNetworkObjectTypeDetail.mockResolvedValue({ dataProperties: [] });
    mockDesignerName("AI 订单数");

    render(<ObjectMetricFormScene mode="create" />);
    fireEvent.change(await screen.findByLabelText("描述要创建的对象指标"), {
      target: { value: "帮我检查一下当前表单" },
    });
    fireEvent.click(screen.getByLabelText("发送对象指标描述"));
    expect(await screen.findByText(/定义校验未通过/)).toBeInTheDocument();
    expect(mocks.validateObjectMetricV1).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("描述要创建的对象指标"), {
      target: { value: "帮我修正表单错误" },
    });
    fireEvent.click(screen.getByLabelText("发送对象指标描述"));
    await waitFor(() => expect(mocks.runObjectMetricDesigner).toHaveBeenCalledTimes(1));
    const diagnostic = mocks.runObjectMetricDesigner.mock.calls[0][0].diagnostic;
    expect(diagnostic).toMatchObject({
      kind: "validation",
      status: "invalid",
    });
    expect(diagnostic?.issues?.some((issue) => issue.code === "form_validation")).toBe(true);
  }, 30_000);

  it("keeps a diagnostic bound to the same form revision across follow-up turns", async () => {
    mocks.routeParams.current = { metricId: undefined, networkId: "network-1" };
    mocks.searchParams.current = "objectTypeId=order&metricType=atomic";
    mocks.getKnowledgeNetworkObjectTypeDetail.mockResolvedValue({ dataProperties: [] });
    mockDesignerName("AI 订单数");

    render(<ObjectMetricFormScene mode="create" />);
    fireEvent.change(await screen.findByLabelText("对象指标名称"), {
      target: { value: "订单数" },
    });
    fireEvent.change(screen.getByLabelText("业务定义"), {
      target: { value: "统计订单数" },
    });
    fireEvent.change(screen.getByLabelText("描述要创建的对象指标"), {
      target: { value: "验证当前表单" },
    });
    fireEvent.click(screen.getByLabelText("发送对象指标描述"));
    expect(await screen.findByText(/定义校验通过/)).toBeInTheDocument();

    for (const prompt of ["第一轮", "第二轮"]) {
      fireEvent.change(screen.getByLabelText("描述要创建的对象指标"), {
        target: { value: prompt },
      });
      fireEvent.click(screen.getByLabelText("发送对象指标描述"));
      await waitFor(() =>
        expect(mocks.runObjectMetricDesigner).toHaveBeenCalledTimes(prompt === "第一轮" ? 1 : 2),
      );
      expect(await screen.findByText("待应用的修改建议")).toBeInTheDocument();
    }
    const first = mocks.runObjectMetricDesigner.mock.calls[0][0];
    const second = mocks.runObjectMetricDesigner.mock.calls[1][0];
    expect(first.baseFormRevision).toBe(second.baseFormRevision);
    expect(first.diagnostic?.form_revision).toBe(first.baseFormRevision);
    expect(second.diagnostic?.form_revision).toBe(second.baseFormRevision);
  }, 60_000);

  it("applies a selected composite expression without changing dependencies", async () => {
    mocks.routeParams.current = { metricId: undefined, networkId: "network-1" };
    mocks.searchParams.current = "objectTypeId=order&metricType=composite";
    mocks.getKnowledgeNetworkObjectTypeDetail.mockResolvedValue({ dataProperties: [] });
    mocks.runObjectMetricDesigner.mockImplementation((params) =>
      Promise.resolve({
        answer: "建议修改表达式",
        proposal: {
          kind: "metric_design_proposal",
          base_form_revision: params.baseFormRevision,
          summary: "修改表达式",
          questions: [],
          changes: [
            {
              field: "composite.expression",
              operation: "replace",
              before: { node_type: "literal", value: 0, value_type: "decimal" },
              after: { node_type: "literal", value: 7, value_type: "decimal" },
              reason: "用户要求",
            },
          ],
        },
        runId: "run-1",
        threadId: "thread-1",
      }),
    );

    render(<ObjectMetricFormScene mode="create" />);
    fireEvent.change(await screen.findByLabelText("描述要创建的对象指标"), {
      target: { value: "改成常数表达式" },
    });
    fireEvent.click(screen.getByLabelText("发送对象指标描述"));
    fireEvent.click(await findButtonByText("应用所选修改"));
    fireEvent.change(screen.getByLabelText("描述要创建的对象指标"), {
      target: { value: "继续检查" },
    });
    fireEvent.click(screen.getByLabelText("发送对象指标描述"));
    await waitFor(() => expect(mocks.runObjectMetricDesigner).toHaveBeenCalledTimes(2));
    expect(mocks.runObjectMetricDesigner.mock.calls[1][0].formSnapshot).toMatchObject({
      "composite.expression": { node_type: "literal", value: 7, value_type: "decimal" },
      "composite.dependencies": [],
    });
  }, 60_000);

  it("does not silently replace the expression when only composite dependencies are selected", async () => {
    mocks.routeParams.current = { metricId: undefined, networkId: "network-1" };
    mocks.searchParams.current = "objectTypeId=order&metricType=composite";
    mocks.getKnowledgeNetworkObjectTypeDetail.mockResolvedValue({ dataProperties: [] });
    const metrics = ["base-a", "base-b"].map((id) => {
      const definition = createObjectMetricDefinitionV1("atomic", "order");
      definition.id = id;
      definition.version = 1;
      definition.name = id;
      definition.lifecycle.status = "published";
      definition.calculation_scope = "object_set";
      return { definition };
    });
    mocks.listObjectMetricsV1.mockResolvedValue({ entries: metrics, total_count: metrics.length });
    mocks.runObjectMetricDesigner.mockImplementation((params) =>
      Promise.resolve({
        answer: "建议添加依赖",
        proposal: {
          kind: "metric_design_proposal",
          base_form_revision: params.baseFormRevision,
          summary: "添加依赖",
          questions: [],
          changes: [
            {
              field: "composite.dependencies",
              operation: "replace",
              before: [],
              after: [
                { alias: "a", metric_id: "base-a", version: 1 },
                { alias: "b", metric_id: "base-b", version: 1 },
              ],
              reason: "用户要求",
            },
          ],
        },
        runId: "run-1",
        threadId: "thread-1",
      }),
    );

    render(<ObjectMetricFormScene mode="create" />);
    fireEvent.change(await screen.findByLabelText("描述要创建的对象指标"), {
      target: { value: "添加两个依赖" },
    });
    fireEvent.click(screen.getByLabelText("发送对象指标描述"));
    fireEvent.click(await findButtonByText("应用所选修改"));
    fireEvent.change(screen.getByLabelText("描述要创建的对象指标"), {
      target: { value: "继续检查" },
    });
    fireEvent.click(screen.getByLabelText("发送对象指标描述"));
    await waitFor(() => expect(mocks.runObjectMetricDesigner).toHaveBeenCalledTimes(2));
    expect(mocks.runObjectMetricDesigner.mock.calls[1][0].formSnapshot).toMatchObject({
      "composite.expression": { node_type: "literal", value: 0, value_type: "decimal" },
      "composite.dependencies": [
        { alias: "a", metric_ref: { metric_id: "base-a", version: 1 } },
        { alias: "b", metric_ref: { metric_id: "base-b", version: 1 } },
      ],
    });
  }, 60_000);

  it("requires an explicit drawer action before sharing a bounded trial diagnostic", async () => {
    mocks.routeParams.current = { metricId: undefined, networkId: "network-1" };
    mocks.searchParams.current = "objectTypeId=order&metricType=atomic";
    mocks.getKnowledgeNetworkObjectTypeDetail.mockResolvedValue({ dataProperties: [] });
    mocks.trialObjectMetricDataV1.mockResolvedValue({
      status: "partial",
      warnings: ["部分数据不可用"],
      overall_ms: 31,
      entries: [{ status: "ok", value: 42, instance_identity: { order_id: "private-1" } }],
      model: {
        output_shape: "summary",
        value: { physical_type: "int64", unit: { code: "1" } },
      },
    });
    mockDesignerName("AI 订单数");

    render(<ObjectMetricFormScene mode="create" />);
    fireEvent.change(await screen.findByLabelText("对象指标名称"), {
      target: { value: "订单数" },
    });
    fireEvent.change(screen.getByLabelText("业务定义"), {
      target: { value: "统计当前对象类中的订单数量" },
    });
    fireEvent.change(screen.getByLabelText("描述要创建的对象指标"), {
      target: { value: "试算当前表单" },
    });
    fireEvent.click(screen.getByLabelText("发送对象指标描述"));
    expect(await screen.findByText("执行模拟试算")).toBeInTheDocument();
    expect(await screen.findByText(/已打开试算抽屉/)).toBeInTheDocument();
    expect(mocks.trialObjectMetricDataV1).not.toHaveBeenCalled();
    expect(mocks.runObjectMetricDesigner).not.toHaveBeenCalled();

    fireEvent.click(getButtonByText("执行模拟试算"));
    await waitFor(() => expect(mocks.trialObjectMetricDataV1).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/试算状态：部分结果/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("描述要创建的对象指标"), {
      target: { value: "为什么是部分结果" },
    });
    fireEvent.click(screen.getByLabelText("发送对象指标描述"));
    await waitFor(() => expect(mocks.runObjectMetricDesigner).toHaveBeenCalledTimes(1));
    const diagnostic = mocks.runObjectMetricDesigner.mock.calls[0][0].diagnostic;
    expect(diagnostic).toMatchObject({
      kind: "trial",
      status: "partial",
      entry_count: 1,
      overall_ms: 31,
      warnings: ["部分数据不可用"],
    });
    expect(diagnostic).not.toHaveProperty("entries");
    expect(diagnostic).not.toHaveProperty("instance_identity");
  }, 30_000);

  it("reports a denied trial as forbidden rather than unavailable", async () => {
    mocks.routeParams.current = { metricId: undefined, networkId: "network-1" };
    mocks.searchParams.current = "objectTypeId=order&metricType=atomic";
    mocks.getKnowledgeNetworkObjectTypeDetail.mockResolvedValue({ dataProperties: [] });
    mocks.trialObjectMetricDataV1.mockRejectedValue(
      Object.assign(new Error("denied"), {
        isAxiosError: true,
        response: { status: 403 },
      }),
    );
    mockDesignerName("AI 订单数");

    render(<ObjectMetricFormScene mode="create" />);
    fireEvent.change(await screen.findByLabelText("对象指标名称"), {
      target: { value: "订单数" },
    });
    fireEvent.change(screen.getByLabelText("业务定义"), {
      target: { value: "统计订单数" },
    });
    fireEvent.change(screen.getByLabelText("描述要创建的对象指标"), {
      target: { value: "请试算当前表单" },
    });
    fireEvent.click(screen.getByLabelText("发送对象指标描述"));
    fireEvent.click(await findButtonByText("执行模拟试算"));
    expect(await screen.findByText(/无权试算/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("描述要创建的对象指标"), {
      target: { value: "为什么不能试算" },
    });
    fireEvent.click(screen.getByLabelText("发送对象指标描述"));
    await waitFor(() => expect(mocks.runObjectMetricDesigner).toHaveBeenCalledTimes(1));
    expect(mocks.runObjectMetricDesigner.mock.calls[0][0].diagnostic?.status).toBe("forbidden");
  }, 30_000);

  it("does not offer a silent fallback or save when object-type detail fails", async () => {
    mocks.routeParams.current = { metricId: undefined, networkId: "network-1" };
    mocks.searchParams.current = "objectTypeId=order&metricType=atomic";
    mocks.getKnowledgeNetworkObjectTypeDetail.mockRejectedValueOnce(new Error("offline"));

    render(<ObjectMetricFormScene mode="create" />);

    expect(await screen.findByText("对象属性加载失败")).toBeInTheDocument();
    fireEvent.click(getButtonByText("保存草稿"));
    await waitFor(() => expect(mocks.message.error).toHaveBeenCalled());
    expect(mocks.createObjectMetricDraftV1).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("返回对象指标列表"));
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/knowledge-network/workspace/network-1/metrics?objectTypeId=order",
    );
  });
});

describe("ObjectMetricFormScene edit loading", () => {
  it("resets inherited fields when AI changes a derived metric's base metric", async () => {
    const ref = (propertyName: string) => ({
      object_type_id: "order",
      property_name: propertyName,
    });
    const recordFor = (definition: ReturnType<typeof createObjectMetricDefinitionV1>) => ({
      branch: "main",
      create_time: 0,
      creator: { id: "owner", type: "user" },
      definition,
      kn_id: "network-1",
      update_time: 0,
      updater: { id: "owner", type: "user" },
    });
    const baseA = createObjectMetricDefinitionV1("atomic", "order");
    baseA.id = "base-a";
    baseA.name = "基础对象指标 A";
    baseA.lifecycle.status = "published";
    baseA.query_capabilities.analysis_dimensions = [ref("region")];
    baseA.query_capabilities.time_dimensions = [ref("signed_at")];
    baseA.result_semantics.value = {
      physical_type: "int64",
      semantic_type: "count",
      unit: { code: "1", quantity_kind: "count", scale_factor: 1, system: "UCUM" },
    };
    const baseB = createObjectMetricDefinitionV1("atomic", "order");
    baseB.id = "base-b";
    baseB.name = "基础对象指标 B";
    baseB.lifecycle.status = "published";
    baseB.query_capabilities.analysis_dimensions = [ref("product")];
    baseB.query_capabilities.time_dimensions = [ref("created_at")];
    baseB.result_semantics.value = {
      physical_type: "decimal",
      precision: 18,
      rounding_mode: "half_up",
      scale: 2,
      semantic_type: "measure",
    };
    const draft = createObjectMetricDefinitionV1("derived", "order");
    draft.id = "derived-draft";
    draft.name = "派生对象指标";
    draft.code = "derived_draft";
    draft.description = "基于基础对象指标的派生统计";
    draft.query_capabilities.analysis_dimensions = [ref("region")];
    draft.query_capabilities.time_dimensions = [ref("signed_at")];
    draft.result_semantics.statistical_grain.group_by_dimensions = [ref("region")];
    draft.result_semantics.value = baseA.result_semantics.value;
    if (draft.specification.kind !== "derived") throw new Error("expected derived metric");
    draft.specification.base_metric = { metric_id: "base-a", version: 1 };
    draft.specification.business_qualifiers.event_time = ref("signed_at");
    mocks.getObjectMetricV1.mockResolvedValue(recordFor(draft));
    mocks.listObjectMetricsV1.mockResolvedValue({
      entries: [recordFor(baseA), recordFor(baseB)],
      total_count: 2,
    });
    mocks.getKnowledgeNetworkObjectTypeDetail.mockResolvedValue({
      dataProperties: ["region", "signed_at", "product", "created_at"].map((name) => ({
        displayName: name,
        name,
        type: name.endsWith("_at") ? "datetime" : "string",
      })),
    });
    mocks.runObjectMetricDesigner.mockImplementation((params) =>
      Promise.resolve({
        answer: "建议更换基础对象指标",
        proposal: {
          base_form_revision: params.baseFormRevision,
          changes: [
            {
              after: "base-b",
              before: "base-a",
              field: "derived.base_metric_id",
              operation: "replace",
              reason: "用户要求",
            },
            {
              after: 1,
              before: 1,
              field: "derived.base_metric_version",
              operation: "replace",
              reason: "固定发布版本",
            },
          ],
          kind: "metric_design_proposal",
          questions: [],
          summary: "更换基础对象指标",
        },
        runId: "run-derived",
        threadId: "thread-derived",
      }),
    );

    mocks.routeParams.current = { metricId: "derived-draft", networkId: "network-1" };
    render(<ObjectMetricFormScene mode="edit" />);
    expect(await screen.findByLabelText("对象指标名称")).toHaveValue("派生对象指标");
    const aiButton = screen.getByText("AI 生成").closest("button");
    if (!aiButton) throw new Error("expected AI button");
    fireEvent.click(aiButton);
    const promptInput = screen.getByLabelText("描述要创建的对象指标");
    const sendButton = screen.getByLabelText("发送对象指标描述");
    fireEvent.change(promptInput, {
      target: { value: "改为基础对象指标 B" },
    });
    fireEvent.click(sendButton);
    const applyButton = (await screen.findByText("应用所选修改")).closest("button");
    if (!applyButton) throw new Error("expected apply button");
    fireEvent.click(applyButton);
    fireEvent.change(promptInput, {
      target: { value: "验证当前表单" },
    });
    fireEvent.click(sendButton);
    await waitFor(() => expect(mocks.validateObjectMetricV1).toHaveBeenCalled());
    const next = mocks.validateObjectMetricV1.mock.lastCall?.[1];
    if (!next || next.specification.kind !== "derived") throw new Error("expected derived metric");
    expect(next.specification.base_metric).toEqual({ metric_id: "base-b", version: 1 });
    expect(next.query_capabilities.analysis_dimensions).toEqual([]);
    expect(next.query_capabilities.time_dimensions).toEqual([]);
    expect(next.result_semantics.statistical_grain.group_by_dimensions).toEqual([]);
    expect(next.result_semantics.value.physical_type).toBe("decimal");
    expect(next.specification.business_qualifiers.event_time).toBeUndefined();
  }, 10_000);

  it("returns to the originating object selection even when edit loading fails", async () => {
    const returnTo =
      "/knowledge-network/workspace/network-1/metrics?objectTypeId=customer&view=list";
    mocks.locationState.current = { knowledgeNetworkReturnTo: returnTo };
    mocks.getObjectMetricV1.mockRejectedValueOnce(new Error("request timeout"));

    render(<ObjectMetricFormScene mode="edit" />);

    fireEvent.click(await findButtonByText("返回对象指标列表"));
    expect(mocks.navigate).toHaveBeenCalledWith(returnTo);
  });

  it.each([
    { error: { isAxiosError: true, response: { status: 403 } }, title: "无权查看该对象指标" },
    { error: { isAxiosError: true, response: { status: 404 } }, title: "对象指标不存在" },
    { error: new Error("request timeout"), title: "对象指标加载失败" },
  ])(
    "does not fall back to creation when the metric cannot be read: $title",
    async ({ error, title }) => {
      mocks.getObjectMetricV1.mockRejectedValueOnce(error);

      render(<ObjectMetricFormScene mode="edit" />);

      expect(await screen.findByText(title)).toBeInTheDocument();
      expect(
        screen.getByText("未加载到原对象指标，编辑操作已停止，不会创建新对象指标。"),
      ).toBeInTheDocument();
      expect(screen.queryByText("保存草稿")).not.toBeInTheDocument();
      await waitFor(() => expect(mocks.getObjectMetricV1).toHaveBeenCalledTimes(1));
      expect(mocks.createObjectMetricDraftV1).not.toHaveBeenCalled();
      expect(mocks.navigate).not.toHaveBeenCalled();
    },
  );
});
