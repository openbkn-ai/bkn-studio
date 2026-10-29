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
    getObjectMetricCapabilitiesV1: vi.fn(),
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
    getObjectMetricCapabilitiesV1: mocks.getObjectMetricCapabilitiesV1,
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
  mocks.getObjectMetricCapabilitiesV1.mockResolvedValue(undefined);
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
  it("uses the configured Agent model and keeps the form when starting another conversation", async () => {
    mocks.routeParams.current = { metricId: undefined, networkId: "network-1" };
    mocks.searchParams.current = "objectTypeId=order&metricType=atomic";
    mocks.getKnowledgeNetworkObjectTypeDetail.mockResolvedValue({ dataProperties: [] });
    mockDesignerName("AI 订单数");

    render(<ObjectMetricFormScene mode="create" />);
    await screen.findByText("平台默认模型");
    expect(document.querySelector("#metric-ai-model")).not.toBeInTheDocument();
    expect(mocks.listObjectMetricAnswerModels).not.toHaveBeenCalled();
    fireEvent.change(await screen.findByLabelText("描述要创建的对象指标"), {
      target: { value: "统计订单数" },
    });
    fireEvent.click(screen.getByLabelText("发送对象指标描述"));
    await waitFor(() => expect(mocks.runObjectMetricDesigner).toHaveBeenCalledTimes(1));
    expect(mocks.runObjectMetricDesigner.mock.calls[0][0]).not.toHaveProperty("modelId");
    expect(await screen.findByText("新对话")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("对象指标名称"), {
      target: { value: "人工填写" },
    });
    fireEvent.click(getButtonByText("新对话"));
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

  it("creates a five-dimension derived draft only after applying and saving the AI proposal", async () => {
    mocks.routeParams.current = { metricId: undefined, networkId: "network-1" };
    mocks.searchParams.current = "objectTypeId=order&metricType=derived";
    const dimensions = ["user_id", "address_id", "channel_id", "order_status", "coupon_id"];
    mocks.getKnowledgeNetworkObjectTypeDetail.mockResolvedValue({
      dataProperties: dimensions.map((name) => ({ displayName: name, name, type: "string" })),
    });
    const base = createObjectMetricDefinitionV1("atomic", "order");
    base.id = "amount-total";
    base.version = 2;
    base.name = "订单总金额";
    base.lifecycle.status = "published";
    base.query_capabilities.analysis_dimensions = dimensions.map((name) => ({
      object_type_id: "order",
      property_name: name,
    }));
    mocks.listObjectMetricsV1.mockResolvedValue({
      entries: [{ definition: base }],
      total_count: 1,
    });
    mocks.runObjectMetricDesigner.mockImplementation((params) =>
      Promise.resolve({
        answer: "建议创建分维度订单总金额",
        proposal: {
          kind: "metric_design_proposal",
          base_form_revision: params.baseFormRevision,
          summary: "已生成待确认的指标建议",
          questions: [],
          changes: [
            {
              field: "name",
              operation: "replace",
              before: "",
              after: "分维度订单总金额",
              reason: "按业务意图命名",
            },
            {
              field: "description",
              operation: "replace",
              before: "",
              after: "按五个业务维度统计订单总金额",
              reason: "明确统计口径",
            },
            {
              field: "derived.base_metric_id",
              operation: "replace",
              before: undefined,
              after: "amount-total",
              reason: "已发布原子指标",
            },
            {
              field: "derived.base_metric_version",
              operation: "replace",
              before: undefined,
              after: 2,
              reason: "固定版本",
            },
            {
              field: "query.group_by_dimensions",
              operation: "replace",
              before: [],
              after: dimensions,
              reason: "用户指定的五个维度",
            },
          ],
        },
        runId: "run-derived-create",
        threadId: "thread-derived-create",
      }),
    );

    render(<ObjectMetricFormScene mode="create" />);
    fireEvent.change(await screen.findByLabelText("描述要创建的对象指标"), {
      target: { value: "根据下单用户、收货地址、渠道、状态和优惠券统计订单总金额" },
    });
    fireEvent.click(screen.getByLabelText("发送对象指标描述"));
    expect(await screen.findByText("待应用的修改建议")).toBeInTheDocument();
    const designSnapshot = mocks.runObjectMetricDesigner.mock.calls[0][0].formSnapshot;
    expect(designSnapshot).toHaveProperty("name", "");
    expect(designSnapshot).not.toHaveProperty("atomic.expression");
    expect(designSnapshot).not.toHaveProperty("composite.expression");
    expect(screen.getByLabelText("对象指标名称")).toHaveValue("");

    fireEvent.click(getButtonByText("应用所选修改"));
    expect(screen.getByLabelText("对象指标名称")).toHaveValue("分维度订单总金额");
    expect(mocks.createObjectMetricDraftV1).not.toHaveBeenCalled();
    fireEvent.click(getButtonByText("保存草稿"));
    await waitFor(() => expect(mocks.createObjectMetricDraftV1).toHaveBeenCalled());
    const definition = mocks.createObjectMetricDraftV1.mock.lastCall?.[1] as
      ObjectMetricDefinitionV1 | undefined;
    if (!definition || definition.specification.kind !== "derived")
      throw new Error("expected derived metric");
    expect(definition.name).toBe("分维度订单总金额");
    expect(definition.specification.base_metric).toEqual({ metric_id: "amount-total", version: 2 });
    expect(
      definition.result_semantics.statistical_grain.group_by_dimensions.map(
        (item) => item.property_name,
      ),
    ).toEqual(dimensions);
    expect(mocks.createObjectMetricDraftV1).toHaveBeenCalledTimes(1);
  }, 30_000);

  it("saves the complete currency unit from an AI atomic metric proposal", async () => {
    mocks.routeParams.current = { metricId: undefined, networkId: "network-1" };
    mocks.searchParams.current = "objectTypeId=order&metricType=atomic";
    mocks.getKnowledgeNetworkObjectTypeDetail.mockResolvedValue({
      dataProperties: [
        { displayName: "单价", name: "price", type: "decimal" },
        { displayName: "成本", name: "cost", type: "decimal" },
        { displayName: "数量", name: "quantity", type: "int64" },
      ],
    });
    mocks.runObjectMetricDesigner.mockImplementation((params) =>
      Promise.resolve({
        answer: "建议汇总毛利润",
        proposal: {
          kind: "metric_design_proposal",
          base_form_revision: params.baseFormRevision,
          summary: "汇总毛利润",
          questions: [],
          changes: [
            {
              field: "name",
              operation: "replace",
              before: "",
              after: "毛利润总额",
              reason: "名称",
            },
            {
              field: "description",
              operation: "replace",
              before: "",
              after: "汇总每条订单的毛利润",
              reason: "业务定义",
            },
            {
              field: "atomic.aggregation",
              operation: "replace",
              before: "count_rows",
              after: "sum",
              reason: "金额求和",
            },
            {
              field: "atomic.expression",
              operation: "replace",
              before: undefined,
              after: {
                node_type: "binary",
                operator: "multiply",
                left: {
                  node_type: "call",
                  function: "greatest",
                  arguments: [
                    {
                      node_type: "binary",
                      operator: "subtract",
                      left: {
                        node_type: "property",
                        property_ref: { object_type_id: "order", property_name: "price" },
                      },
                      right: {
                        node_type: "property",
                        property_ref: { object_type_id: "order", property_name: "cost" },
                      },
                    },
                    { node_type: "literal", value_type: "decimal", value: 0 },
                  ],
                },
                right: {
                  node_type: "property",
                  property_ref: { object_type_id: "order", property_name: "quantity" },
                },
              },
              reason: "嵌套计算公式",
            },
            ...(
              [
                ["result.physical_type", "decimal"],
                ["result.semantic_type", "amount"],
                ["result.quantity_kind", "currency"],
                ["result.unit_system", "ISO_4217"],
                ["result.unit_code", "CNY"],
              ] as const
            ).map(([field, after]) => ({
              field,
              operation: "replace" as const,
              before: undefined,
              after,
              reason: "货币结果",
            })),
          ],
        },
        runId: "run-atomic-currency",
        threadId: "thread-atomic-currency",
      }),
    );

    render(<ObjectMetricFormScene mode="create" />);
    fireEvent.change(await screen.findByLabelText("描述要创建的对象指标"), {
      target: { value: "创建毛利润总额指标，汇总 max(单价减成本, 0) 乘数量，单位人民币元" },
    });
    fireEvent.click(screen.getByLabelText("发送对象指标描述"));
    fireEvent.click(await findButtonByText("应用所选修改"));
    fireEvent.click(getButtonByText("保存草稿"));
    await waitFor(() => expect(mocks.createObjectMetricDraftV1).toHaveBeenCalled());
    const definition = mocks.createObjectMetricDraftV1.mock.lastCall?.[1] as
      ObjectMetricDefinitionV1 | undefined;
    if (!definition || definition.specification.kind !== "atomic")
      throw new Error("expected atomic metric");
    expect(definition.specification.measure.aggregation).toBe("sum");
    expect(definition.specification.measure.expression?.node_type).toBe("binary");
    expect(definition.result_semantics.value.semantic_type).toBe("amount");
    expect(definition.result_semantics.value.unit).toMatchObject({
      code: "CNY",
      quantity_kind: "currency",
      system: "ISO_4217",
    });
  }, 30_000);

  it("rejects an entire AI filter when one nested condition is invalid", async () => {
    mocks.routeParams.current = { metricId: undefined, networkId: "network-1" };
    mocks.searchParams.current = "objectTypeId=order&metricType=derived";
    mocks.getKnowledgeNetworkObjectTypeDetail.mockResolvedValue({
      dataProperties: [{ displayName: "订单状态", name: "order_status", type: "string" }],
    });
    mocks.runObjectMetricDesigner.mockImplementation((params) =>
      Promise.resolve({
        answer: "建议筛选条件",
        proposal: {
          kind: "metric_design_proposal",
          base_form_revision: params.baseFormRevision,
          summary: "筛选条件",
          questions: [],
          changes: [
            {
              field: "derived.filters",
              operation: "replace",
              before: undefined,
              reason: "按要求筛选",
              after: {
                node_type: "group",
                boolean_operator: "and",
                children: [
                  {
                    node_type: "predicate",
                    left: {
                      source: "property",
                      property_ref: {
                        object_type_id: "order",
                        property_name: "order_status",
                      },
                    },
                    comparison_operator: "eq",
                    right: [{ source: "literal", value_type: "string", value: "completed" }],
                  },
                  { node_type: "logical", operator: "or", operands: [] },
                ],
              },
            },
          ],
        },
        runId: "run-invalid-filter",
        threadId: "thread-invalid-filter",
      }),
    );

    render(<ObjectMetricFormScene mode="create" />);
    fireEvent.change(await screen.findByLabelText("描述要创建的对象指标"), {
      target: { value: "只看已完成订单或其他条件" },
    });
    fireEvent.click(screen.getByLabelText("发送对象指标描述"));
    fireEvent.click(await findButtonByText("应用所选修改"));
    expect(mocks.message.error).toHaveBeenCalled();
    expect(screen.getByText("待应用的修改建议")).toBeInTheDocument();
    expect(mocks.createObjectMetricDraftV1).not.toHaveBeenCalled();
  });

  it.each([
    [
      "comparison operator",
      {
        node_type: "predicate",
        left: {
          source: "property",
          property_ref: { object_type_id: "order", property_name: "amount" },
        },
        comparison_operator: "gt",
        right: [{ source: "literal", value_type: "int64", value: 0 }],
      },
    ],
    [
      "boolean operator",
      {
        node_type: "group",
        boolean_operator: "or",
        children: [
          {
            node_type: "predicate",
            left: {
              source: "property",
              property_ref: { object_type_id: "order", property_name: "amount" },
            },
            comparison_operator: "eq",
            right: [{ source: "literal", value_type: "int64", value: 0 }],
          },
        ],
      },
    ],
  ])("rejects an AI filter using a disabled %s", async (_kind, condition) => {
    mocks.routeParams.current = { metricId: undefined, networkId: "network-1" };
    mocks.searchParams.current = "objectTypeId=order&metricType=derived";
    mocks.getKnowledgeNetworkObjectTypeDetail.mockResolvedValue({
      dataProperties: [{ displayName: "金额", name: "amount", type: "int64" }],
    });
    mocks.getObjectMetricCapabilitiesV1.mockResolvedValue({
      aggregations: [],
      boolean_operators: ["and"],
      comparison_operators: ["eq"],
      expression_operators: [],
      functions: [],
      quantity_kinds: [],
      semantic_types: [],
      time_granularities: [],
    });
    mocks.runObjectMetricDesigner.mockImplementation((params) =>
      Promise.resolve({
        answer: "建议筛选条件",
        proposal: {
          kind: "metric_design_proposal",
          base_form_revision: params.baseFormRevision,
          summary: "筛选条件",
          questions: [],
          changes: [
            {
              field: "derived.filters",
              operation: "replace",
              before: undefined,
              after: condition,
              reason: "用户要求",
            },
          ],
        },
        runId: "run-disabled-operator",
        threadId: "thread-disabled-operator",
      }),
    );

    render(<ObjectMetricFormScene mode="create" />);
    fireEvent.change(await screen.findByLabelText("描述要创建的对象指标"), {
      target: { value: "按条件筛选" },
    });
    fireEvent.click(screen.getByLabelText("发送对象指标描述"));
    fireEvent.click(await findButtonByText("应用所选修改"));
    expect(mocks.message.error).toHaveBeenCalled();
    expect(screen.getByText("待应用的修改建议")).toBeInTheDocument();
  });

  it("rebuilds both AI property operands from the current owner and property names", async () => {
    mocks.routeParams.current = { metricId: undefined, networkId: "network-1" };
    mocks.searchParams.current = "objectTypeId=order&metricType=derived";
    mocks.getKnowledgeNetworkObjectTypeDetail.mockResolvedValue({
      dataProperties: ["amount", "limit"].map((name) => ({
        displayName: name,
        name,
        type: "int64",
      })),
    });
    mocks.runObjectMetricDesigner.mockImplementation((params) =>
      Promise.resolve({
        answer: "建议比较两个属性",
        proposal: {
          kind: "metric_design_proposal",
          base_form_revision: params.baseFormRevision,
          summary: "比较属性",
          questions: [],
          changes: [
            {
              field: "derived.filters",
              operation: "replace",
              before: undefined,
              after: {
                node_type: "predicate",
                left: { source: "property", property_ref: { property_name: "amount" } },
                comparison_operator: "gt",
                right: [
                  {
                    source: "property",
                    property_ref: { property_name: "limit", property_id: "untrusted" },
                  },
                ],
              },
              reason: "用户要求",
            },
          ],
        },
        runId: "run-property-filter",
        threadId: "thread-property-filter",
      }),
    );

    render(<ObjectMetricFormScene mode="create" />);
    const prompt = await screen.findByLabelText("描述要创建的对象指标");
    fireEvent.change(prompt, { target: { value: "金额大于限额" } });
    fireEvent.click(screen.getByLabelText("发送对象指标描述"));
    fireEvent.click(await findButtonByText("应用所选修改"));
    expect(mocks.message.error).not.toHaveBeenCalled();
    fireEvent.change(prompt, { target: { value: "检查当前条件" } });
    fireEvent.click(screen.getByLabelText("发送对象指标描述"));
    await waitFor(() => expect(mocks.runObjectMetricDesigner).toHaveBeenCalledTimes(2));
    expect(
      mocks.runObjectMetricDesigner.mock.lastCall?.[0].formSnapshot["derived.filters"],
    ).toEqual({
      node_type: "predicate",
      left: {
        source: "property",
        property_ref: { object_type_id: "order", property_name: "amount" },
      },
      comparison_operator: "gt",
      right: [
        {
          source: "property",
          property_ref: { object_type_id: "order", property_name: "limit" },
        },
      ],
    });
  });

  it("rejects an AI expression with an unsupported nested node", async () => {
    mocks.routeParams.current = { metricId: undefined, networkId: "network-1" };
    mocks.searchParams.current = "objectTypeId=order&metricType=atomic";
    mocks.getKnowledgeNetworkObjectTypeDetail.mockResolvedValue({
      dataProperties: [{ displayName: "金额", name: "amount", type: "decimal" }],
    });
    mocks.runObjectMetricDesigner.mockImplementation((params) =>
      Promise.resolve({
        answer: "建议公式",
        proposal: {
          kind: "metric_design_proposal",
          base_form_revision: params.baseFormRevision,
          summary: "调整公式",
          questions: [],
          changes: [
            {
              field: "atomic.expression",
              operation: "replace",
              before: undefined,
              after: {
                node_type: "binary",
                operator: "multiply",
                left: {
                  node_type: "property",
                  property_ref: { object_type_id: "order", property_name: "amount" },
                },
                right: { node_type: "literal", value: 2 },
              },
              reason: "用户要求",
            },
          ],
        },
        runId: "run-invalid-expression",
        threadId: "thread-invalid-expression",
      }),
    );

    render(<ObjectMetricFormScene mode="create" />);
    fireEvent.change(await screen.findByLabelText("描述要创建的对象指标"), {
      target: { value: "金额乘二" },
    });
    fireEvent.click(screen.getByLabelText("发送对象指标描述"));
    fireEvent.click(await findButtonByText("应用所选修改"));
    expect(mocks.message.error).toHaveBeenCalled();
    expect(screen.getByText("待应用的修改建议")).toBeInTheDocument();
    expect(mocks.createObjectMetricDraftV1).not.toHaveBeenCalled();
  });

  it("rejects a derived metric proposal that selects another derived metric as its base", async () => {
    mocks.routeParams.current = { metricId: undefined, networkId: "network-1" };
    mocks.searchParams.current = "objectTypeId=order&metricType=derived";
    mocks.getKnowledgeNetworkObjectTypeDetail.mockResolvedValue({ dataProperties: [] });
    const derivedBase = createObjectMetricDefinitionV1("derived", "order");
    derivedBase.id = "derived-base";
    derivedBase.lifecycle.status = "published";
    mocks.listObjectMetricsV1.mockResolvedValue({
      entries: [{ definition: derivedBase }],
      total_count: 1,
    });
    mocks.runObjectMetricDesigner.mockImplementation((params) =>
      Promise.resolve({
        answer: "建议基准",
        proposal: {
          kind: "metric_design_proposal",
          base_form_revision: params.baseFormRevision,
          summary: "更换基准",
          questions: [],
          changes: [
            {
              field: "derived.base_metric_id",
              operation: "replace",
              before: undefined,
              after: "derived-base",
              reason: "候选指标",
            },
            {
              field: "derived.base_metric_version",
              operation: "replace",
              before: undefined,
              after: 1,
              reason: "候选版本",
            },
          ],
        },
        runId: "run-invalid-base",
        threadId: "thread-invalid-base",
      }),
    );

    render(<ObjectMetricFormScene mode="create" />);
    fireEvent.change(await screen.findByLabelText("描述要创建的对象指标"), {
      target: { value: "用这个衍生指标作为基准" },
    });
    fireEvent.click(screen.getByLabelText("发送对象指标描述"));
    fireEvent.click(await findButtonByText("应用所选修改"));
    expect(mocks.message.error).toHaveBeenCalled();
    expect(screen.getByText("待应用的修改建议")).toBeInTheDocument();
    expect(mocks.createObjectMetricDraftV1).not.toHaveBeenCalled();
  });

  it("applies a base version-only change together with other selected fields", async () => {
    const baseV1 = createObjectMetricDefinitionV1("atomic", "order");
    baseV1.id = "amount";
    baseV1.version = 1;
    baseV1.lifecycle.status = "published";
    const baseV2 = createObjectMetricDefinitionV1("atomic", "order");
    baseV2.id = "amount";
    baseV2.version = 2;
    baseV2.lifecycle.status = "published";
    const draft = createObjectMetricDefinitionV1("derived", "order");
    draft.id = "derived-draft";
    draft.name = "原名称";
    if (draft.specification.kind !== "derived") throw new Error("expected derived metric");
    draft.specification.base_metric = { metric_id: "amount", version: 1 };
    mocks.getObjectMetricV1.mockResolvedValue({ definition: draft });
    mocks.listObjectMetricsV1.mockResolvedValue({
      entries: [{ definition: baseV1 }, { definition: baseV2 }],
      total_count: 2,
    });
    mocks.getKnowledgeNetworkObjectTypeDetail.mockResolvedValue({ dataProperties: [] });
    mocks.runObjectMetricDesigner.mockImplementation((params) =>
      Promise.resolve({
        answer: "建议升级基准版本",
        proposal: {
          kind: "metric_design_proposal",
          base_form_revision: params.baseFormRevision,
          summary: "升级版本并改名",
          questions: [],
          changes: [
            {
              field: "derived.base_metric_version",
              operation: "replace",
              before: 1,
              after: 2,
              reason: "采用新版本",
            },
            {
              field: "name",
              operation: "replace",
              before: "原名称",
              after: "新名称",
              reason: "改名",
            },
          ],
        },
        runId: "run-version-only",
        threadId: "thread-version-only",
      }),
    );

    mocks.routeParams.current = { metricId: "derived-draft", networkId: "network-1" };
    render(<ObjectMetricFormScene mode="edit" />);
    expect(await screen.findByLabelText("对象指标名称")).toHaveValue("原名称");
    fireEvent.click(getButtonByText("AI 生成"));
    const prompt = screen.getByLabelText("描述要创建的对象指标");
    fireEvent.change(prompt, { target: { value: "基准指标升到第二版并改名" } });
    fireEvent.click(screen.getByLabelText("发送对象指标描述"));
    fireEvent.click(await findButtonByText("应用所选修改"));
    expect(mocks.message.error).not.toHaveBeenCalled();
    expect(screen.getByLabelText("对象指标名称")).toHaveValue("新名称");
    expect(screen.getByText("已锁定发布版本 v2")).toBeInTheDocument();
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
    await waitFor(() => expect(mocks.runObjectMetricDesigner).toHaveBeenCalledTimes(1));
    const designSnapshot = mocks.runObjectMetricDesigner.mock.lastCall?.[0].formSnapshot;
    expect(designSnapshot).toMatchObject({
      "derived.base_metric_id": "base-a",
      "derived.base_metric_version": 1,
    });
    expect(designSnapshot).not.toHaveProperty("atomic.expression");
    expect(designSnapshot).not.toHaveProperty("composite.expression");
    expect(designSnapshot).not.toHaveProperty("code");
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
