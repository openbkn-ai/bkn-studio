/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createObjectMetricDefinitionV1 } from "@/modules/knowledge-network/components/object-metric/object-metric-model";
import type { ObjectMetricRecordV1 } from "@/modules/knowledge-network/types/object-metric";

const mocks = vi.hoisted(() => ({
  canAuthorize: { current: true },
  canModify: { current: true },
  createNextDraft: vi.fn(),
  getObjectMetricV1: vi.fn(),
  getObjectTypeDetail: vi.fn(),
  getRelationType: vi.fn(),
  listObjectTypes: vi.fn(),
  listRelationTypes: vi.fn(),
  listMetrics: vi.fn(),
  listVersions: vi.fn(),
  locationSearch: { current: "" },
  locationState: { current: null as { knowledgeNetworkReturnTo?: string } | null },
  navigate: vi.fn(),
  queryMetric: vi.fn(),
  trialMetric: vi.fn(),
  upgradeMetric: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useLocation: () => ({ search: mocks.locationSearch.current, state: mocks.locationState.current }),
  useNavigate: () => mocks.navigate,
  useParams: () => ({ metricId: "metric-1", networkId: "network-1" }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: { success: vi.fn() } }),
}));

vi.mock("@/modules/knowledge-network/hooks/useKnowledgeNetworkCanModify", () => ({
  useKnowledgeNetworkCanModify: () => mocks.canModify.current,
  useKnowledgeNetworkCanOperate: () => mocks.canAuthorize.current,
}));

vi.mock(
  "@/modules/knowledge-network/components/shared/KnowledgeNetworkAuthorizationActionLabel",
  () => ({
    KnowledgeNetworkAuthorizationActionLabel: ({ children }: { children: ReactNode }) => children,
  }),
);

vi.mock("@/modules/knowledge-network/components/object-metric/ObjectMetricAuthorizeDrawer", () => ({
  ObjectMetricAuthorizeDrawer: ({
    metric,
    networkId,
    open,
  }: {
    metric?: ObjectMetricRecordV1;
    networkId: string;
    open: boolean;
  }) =>
    open ? (
      <div
        data-metric-id={metric?.definition.id}
        data-network-id={networkId}
        data-testid="metric-authorization-drawer"
      />
    ) : null,
}));

vi.mock("@/modules/knowledge-network/services/object-metric.service", () => ({
  bindObjectMetricLogicPropertyV1: vi.fn(),
  createNextObjectMetricDraftV1: mocks.createNextDraft,
  getObjectMetricV1: mocks.getObjectMetricV1,
  listObjectMetricsV1: mocks.listMetrics,
  listObjectMetricVersionsV1: mocks.listVersions,
  queryObjectMetricDataV1: mocks.queryMetric,
  trialObjectMetricDataV1: mocks.trialMetric,
  upgradeObjectMetricLogicPropertyV1: mocks.upgradeMetric,
}));

vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  listKnowledgeNetworkObjectTypes: mocks.listObjectTypes,
  listKnowledgeNetworkRelationTypes: mocks.listRelationTypes,
}));

vi.mock("@/modules/knowledge-network/services/object-type.service", () => ({
  getKnowledgeNetworkObjectTypeDetail: mocks.getObjectTypeDetail,
}));

vi.mock("@/modules/knowledge-network/services/relation-type.service", () => ({
  getKnowledgeNetworkRelationType: mocks.getRelationType,
}));

vi.mock("@/modules/knowledge-network/components/object-metric/ObjectMetricLineagePanel", () => ({
  ObjectMetricLineagePanel: ({
    onOpenMetric,
  }: {
    onOpenMetric: (metricId: string, version: number) => void;
  }) => <button onClick={() => onOpenMetric("base-metric", 1)}>Open related metric</button>,
}));

vi.mock("@/modules/knowledge-network/components/object-metric/ObjectMetricTrialDrawer", () => ({
  ObjectMetricTrialDrawer: ({
    mode,
    onRun,
    open,
  }: {
    mode: "draft" | "published";
    onRun: (query: object) => Promise<unknown>;
    open: boolean;
  }) =>
    open ? (
      <div data-mode={mode} data-testid="metric-trial-drawer">
        <button onClick={() => void onRun({})}>Run trial</button>
      </div>
    ) : null,
}));

import { ObjectMetricDetailScene } from "./ObjectMetricDetailScene";

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
  mocks.canAuthorize.current = true;
  mocks.canModify.current = true;
  mocks.createNextDraft.mockReset();
  mocks.getObjectMetricV1.mockReset();
  mocks.getObjectTypeDetail.mockReset();
  mocks.getObjectTypeDetail.mockResolvedValue(null);
  mocks.getRelationType.mockReset();
  mocks.getRelationType.mockResolvedValue(null);
  mocks.listObjectTypes.mockReset();
  mocks.listObjectTypes.mockResolvedValue([]);
  mocks.listRelationTypes.mockReset();
  mocks.listRelationTypes.mockResolvedValue([]);
  mocks.listMetrics.mockReset();
  mocks.listMetrics.mockResolvedValue({ entries: [], total_count: 0 });
  mocks.listVersions.mockReset();
  mocks.listVersions.mockResolvedValue([]);
  mocks.locationSearch.current = "";
  mocks.locationState.current = null;
  mocks.navigate.mockReset();
  mocks.queryMetric.mockReset();
  mocks.trialMetric.mockReset();
  mocks.upgradeMetric.mockReset();
});

mocks.listVersions.mockResolvedValue([]);
mocks.listMetrics.mockResolvedValue({ entries: [], total_count: 0 });
mocks.getObjectTypeDetail.mockResolvedValue(null);

function record(
  status: ObjectMetricRecordV1["definition"]["lifecycle"]["status"],
  calculationScope: ObjectMetricRecordV1["definition"]["calculation_scope"],
): ObjectMetricRecordV1 {
  const definition = createObjectMetricDefinitionV1("atomic", "order");
  definition.id = "metric-1";
  definition.code = "coupon_used_count";
  definition.name = "已用券次数";
  definition.lifecycle.status = status;
  definition.calculation_scope = calculationScope;
  return { definition } as ObjectMetricRecordV1;
}

describe("ObjectMetricDetailScene actions", () => {
  it("opens the current metric authorization from the detail header", async () => {
    const published = record("published", "object_set");
    published.definition.version = 4;
    mocks.getObjectMetricV1.mockResolvedValue(published);
    mocks.listVersions.mockResolvedValue([published]);

    render(<ObjectMetricDetailScene />);

    fireEvent.click(await screen.findByRole("button", { name: "配置权限" }));
    const drawer = screen.getByTestId("metric-authorization-drawer");
    expect(drawer).toHaveAttribute("data-network-id", "network-1");
    expect(drawer).toHaveAttribute("data-metric-id", "metric-1");
  });

  it("hides metric authorization without knowledge-network authorize permission", async () => {
    const published = record("published", "object_set");
    mocks.canAuthorize.current = false;
    mocks.getObjectMetricV1.mockResolvedValue(published);
    mocks.listVersions.mockResolvedValue([published]);

    render(<ObjectMetricDetailScene />);

    await screen.findByText("已用券次数");
    expect(screen.queryByRole("button", { name: "配置权限" })).not.toBeInTheDocument();
  });

  it("loads only referenced object and relation names instead of full catalogs", async () => {
    const derived = record("published", "object_set");
    derived.definition.metric_type = "derived";
    derived.definition.specification = {
      kind: "derived",
      base_metric: { metric_id: "base", version: 1 },
      business_qualifiers: {
        event_time: { object_type_id: "related", property_name: "created_at" },
        relation_path: {
          alias: "related",
          cardinality_policy: "preserve_root",
          purpose: "qualify_root",
          steps: [
            {
              direction: "outgoing",
              relation_type_id: "relation-1",
              target_object_type_id: "related",
            },
          ],
        },
      },
    };
    mocks.getObjectMetricV1.mockResolvedValue(derived);
    mocks.listVersions.mockResolvedValue([derived]);
    mocks.getObjectTypeDetail.mockImplementation((_networkId: string, id: string) =>
      Promise.resolve({
        id,
        name: id === "related" ? "关联对象" : "销售订单",
        dataProperties: [],
        logicProperties: [],
      }),
    );
    mocks.getRelationType.mockResolvedValue({ id: "relation-1", name: "订单关联对象" });

    render(<ObjectMetricDetailScene />);
    await waitFor(() =>
      expect(mocks.getRelationType).toHaveBeenCalledWith("network-1", "relation-1"),
    );
    expect(await screen.findByText("订单关联对象")).toBeInTheDocument();
    expect(mocks.getObjectTypeDetail).toHaveBeenCalledWith("network-1", "related");
    expect(mocks.getRelationType).toHaveBeenCalledWith("network-1", "relation-1");
    expect(mocks.listObjectTypes).not.toHaveBeenCalled();
    expect(mocks.listRelationTypes).not.toHaveBeenCalled();
  });

  it("keeps trial available but hides mutation actions without modify permission", async () => {
    const published = record("published", "object_instance");
    mocks.canModify.current = false;
    mocks.getObjectMetricV1.mockResolvedValue(published);
    mocks.listVersions.mockResolvedValue([published]);
    mocks.getObjectTypeDetail.mockResolvedValue({
      id: "order",
      logicProperties: [],
      name: "销售订单",
    });

    render(<ObjectMetricDetailScene />);

    expect(await screen.findByRole("button", { name: "试算" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "绑定逻辑属性" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "创建新版本草稿" })).not.toBeInTheDocument();
  });

  it("does not offer editing a deprecated metric version", async () => {
    const deprecated = record("deprecated", "object_set");
    mocks.getObjectMetricV1.mockResolvedValue(deprecated);
    mocks.listVersions.mockResolvedValue([deprecated]);

    render(<ObjectMetricDetailScene />);

    expect(await screen.findByRole("button", { name: "试算" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "创建新版本草稿" })).not.toBeInTheDocument();
  });

  it("keeps a derived metric's pinned version before its full business name", async () => {
    const derived = record("published", "object_set");
    derived.definition.metric_type = "derived";
    derived.definition.specification = {
      kind: "derived",
      base_metric: { metric_id: "base", version: 1 },
      business_qualifiers: {},
    };
    const base = record("published", "object_set");
    base.definition.id = "base";
    base.definition.name = "GMV（成交总金额）（基础原子指标）";
    mocks.getObjectMetricV1.mockImplementation((_networkId, metricId) =>
      Promise.resolve(metricId === "base" ? base : derived),
    );
    mocks.listMetrics.mockResolvedValue({ entries: [base], total_count: 1 });

    render(<ObjectMetricDetailScene />);

    const name = await screen.findByText(base.definition.name);
    const reference = name.parentElement;
    expect(reference?.className).toContain("metricReference");
    expect(reference?.firstElementChild).toHaveTextContent("v1");
    expect(reference?.lastElementChild).toBe(name);
    expect(screen.queryByText("@v1")).not.toBeInTheDocument();
  });

  it("uses a full-page loading container while the metric is being fetched", () => {
    mocks.getObjectMetricV1.mockReturnValue(new Promise(() => {}));

    const { container } = render(<ObjectMetricDetailScene />);
    const loading = container.querySelector<HTMLElement>("[class*=loading]");

    expect(loading).toBeInTheDocument();
    expect(loading?.querySelector(".ant-spin")).toBeInTheDocument();
    expect(loading).toBe(container.firstElementChild);
  });

  it("labels ownership and scope clearly and gives the business definition its own full-width block", async () => {
    const metric = record("published", "object_instance");
    metric.definition.description = "仅统计已支付订单的金额。\n退款订单不计入。";
    mocks.getObjectMetricV1.mockResolvedValue(metric);
    mocks.getObjectTypeDetail.mockResolvedValue({
      id: "order",
      name: "销售订单",
      dataProperties: [],
      logicProperties: [],
    });

    const { container } = render(<ObjectMetricDetailScene />);

    expect(await screen.findByText("所属对象类")).toBeInTheDocument();
    expect(screen.getByText("计算范围")).toBeInTheDocument();
    expect(screen.getByText(/单个实例/)).toBeInTheDocument();
    const definition = container.querySelector<HTMLElement>("[class*=businessDefinitionContent]");
    expect(definition).toHaveTextContent("仅统计已支付订单的金额。 退款订单不计入。");
    expect(definition?.closest(".ant-descriptions")).toBeNull();
    expect(definition?.parentElement).toHaveTextContent("业务定义");
    expect(await screen.findByText(/逻辑属性：未绑定/)).toBeInTheDocument();
    expect(
      [...container.querySelectorAll(".ant-descriptions-item-label")].map(
        (item) => item.textContent,
      ),
    ).not.toContain("逻辑属性");
  });

  it("shows the projected owner name without exposing its id when object details are unavailable", async () => {
    const metric = record("published", "object_set");
    metric.definition.owner_object_type_id = "confidential-owner-id";
    metric.owner_object_type_name = "销售订单";
    mocks.getObjectMetricV1.mockResolvedValue(metric);
    mocks.getObjectTypeDetail.mockRejectedValue(new Error("forbidden"));

    render(<ObjectMetricDetailScene />);

    expect(await screen.findByText("销售订单")).toBeInTheDocument();
    expect(screen.queryByText("confidential-owner-id")).not.toBeInTheDocument();
  });

  it("uses business labels for calculation and result metadata while retaining technical values in tooltips", async () => {
    const metric = record("published", "object_instance");
    if (metric.definition.specification.kind !== "atomic")
      throw new Error("expected atomic metric");
    metric.definition.specification.measure.expression = {
      node_type: "property",
      property_ref: { object_type_id: "order", property_name: "paid_amount" },
    };
    metric.definition.result_semantics.statistical_grain.time_granularity = "day";
    metric.definition.result_semantics.statistical_grain.timezone = "Asia/Shanghai";
    metric.definition.result_semantics.value.physical_type = "decimal";
    metric.definition.result_semantics.value.semantic_type = "amount";
    metric.definition.result_semantics.value.unit = {
      code: "CNY",
      display_symbol: "¥",
      quantity_kind: "currency",
      scale_factor: 1,
      system: "ISO_4217",
    };
    mocks.getObjectMetricV1.mockResolvedValue(metric);
    mocks.getObjectTypeDetail.mockResolvedValue({
      id: "order",
      name: "销售订单",
      dataProperties: [{ name: "paid_amount", displayName: "实付金额" }],
      logicProperties: [],
    });

    render(<ObjectMetricDetailScene />);

    expect(await screen.findByText("实付金额")).toBeInTheDocument();
    expect(screen.getByText("小数 / 金额")).toBeInTheDocument();
    expect(screen.getByText("日 · Asia/Shanghai")).toBeInTheDocument();
    expect(screen.getByText("¥ (CNY)")).toBeInTheDocument();
    expect(screen.getByText("无（按实例返回）")).toBeInTheDocument();
    expect(screen.queryByText("decimal / amount")).not.toBeInTheDocument();
  });

  it("identifies a transaction count unit instead of showing only its code", async () => {
    const metric = record("published", "object_set");
    metric.definition.result_semantics.value.unit = {
      code: "transaction",
      quantity_kind: "count",
      scale_factor: 1,
      system: "registered",
    };
    mocks.getObjectMetricV1.mockResolvedValue(metric);
    mocks.getObjectTypeDetail.mockResolvedValue({
      id: "order",
      name: "销售订单",
      dataProperties: [],
      logicProperties: [],
    });

    render(<ObjectMetricDetailScene />);

    expect(await screen.findByText("交易笔 (transaction)")).toBeInTheDocument();
    expect(screen.queryByText("transaction")).not.toBeInTheDocument();
  });

  it("keeps composite dependencies compact and hides the technical expression until requested", async () => {
    const composite = record("published", "object_set");
    composite.definition.metric_type = "composite";
    composite.definition.specification = {
      alignment: {
        grain_policy: "same_grain",
        group_by_dimensions: [],
        result_owner_object_type_id: "order",
        result_set_policy: "intersection",
        time_alignment: "same_time_window",
      },
      dependencies: [
        {
          alias: "base",
          metric_ref: { metric_id: "base", version: 1 },
          object_alignment: { mode: "same_object", deduplication: "none" },
          evaluation_context: { window: "inherited", filter_context: { mode: "inherit" } },
        },
      ],
      expression: { node_type: "dependency", dependency_alias: "base" },
      kind: "composite",
      null_policy: "propagate",
      zero_division_policy: "unavailable",
    };
    const base = record("published", "object_set");
    base.definition.id = "base";
    base.definition.name = "基础订单数";
    mocks.getObjectMetricV1.mockImplementation((_networkId, metricId) =>
      Promise.resolve(metricId === "base" ? base : composite),
    );

    render(<ObjectMetricDetailScene />);

    expect(await screen.findByText("基础订单数 · v1")).toBeInTheDocument();
    expect(screen.queryByText(/公式符号：base/)).not.toBeInTheDocument();
    const summary = screen.getByText("技术表达式");
    const details = summary.closest("details");
    expect(details).not.toHaveAttribute("open");
    fireEvent.click(summary);
    expect(details).toHaveAttribute("open");
  });

  it("shows business property names in result and analysis while retaining unknown property names", async () => {
    const metric = record("published", "object_set");
    metric.definition.result_semantics.statistical_grain.group_by_dimensions = [
      { object_type_id: "order", property_name: "template_id" },
    ];
    metric.definition.query_capabilities.analysis_dimensions = [
      { object_type_id: "order", property_name: "status" },
    ];
    metric.definition.query_capabilities.time_dimensions = [
      { object_type_id: "order", property_name: "unknown_time" },
    ];
    mocks.getObjectMetricV1.mockResolvedValue(metric);
    mocks.getObjectTypeDetail.mockResolvedValue({
      id: "order",
      dataProperties: [
        { name: "template_id", displayName: "模板" },
        { name: "status", displayName: "订单状态" },
      ],
      logicProperties: [],
    });

    render(<ObjectMetricDetailScene />);

    expect(await screen.findByText("模板", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText("订单状态")).toBeInTheDocument();
    expect(screen.getByText("unknown_time")).toBeInTheDocument();
    expect(screen.queryByText("template_id")).not.toBeInTheDocument();
  });

  it("shows three dimensions by default and expands the rest without changing the definition", async () => {
    const metric = record("published", "object_set");
    metric.definition.query_capabilities.analysis_dimensions = Array.from(
      { length: 5 },
      (_, index) => ({
        object_type_id: "order",
        property_name: `analysis_${index + 1}`,
      }),
    );
    metric.definition.query_capabilities.time_dimensions = Array.from(
      { length: 4 },
      (_, index) => ({
        object_type_id: "order",
        property_name: `time_${index + 1}`,
      }),
    );
    mocks.getObjectMetricV1.mockResolvedValue(metric);
    mocks.getObjectTypeDetail.mockResolvedValue({
      id: "order",
      dataProperties: [
        ...Array.from({ length: 5 }, (_, index) => ({
          name: `analysis_${index + 1}`,
          displayName: `分析字段${index + 1}`,
        })),
        ...Array.from({ length: 4 }, (_, index) => ({
          name: `time_${index + 1}`,
          displayName: `时间字段${index + 1}`,
        })),
      ],
      logicProperties: [],
    });

    render(<ObjectMetricDetailScene />);

    expect(
      await screen.findByText("分析字段1、分析字段2、分析字段3", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/分析字段4/)).not.toBeInTheDocument();
    expect(screen.getByText("时间字段1、时间字段2、时间字段3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "还有 2 项" }));
    expect(
      screen.getByText("分析字段1、分析字段2、分析字段3、分析字段4、分析字段5"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "还有 1 项" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "收起" }));
    expect(screen.queryByText(/分析字段4/)).not.toBeInTheDocument();
  });

  it("places available actions beside the metric identity without a large usage card", async () => {
    mocks.getObjectMetricV1.mockResolvedValue(record("published", "object_instance"));
    mocks.getObjectTypeDetail.mockResolvedValue({
      id: "order",
      name: "销售订单",
      dataProperties: [],
      logicProperties: [],
    });

    const { container } = render(<ObjectMetricDetailScene />);

    expect(await screen.findByRole("heading", { name: "已用券次数" })).toBeInTheDocument();
    expect(screen.queryByText("使用与验证")).not.toBeInTheDocument();
    expect(
      [...container.querySelectorAll(".ant-card-head-title")].map((item) => item.textContent),
    ).toEqual(["基本信息", "计算逻辑", "结果与分析", "依赖与引用"]);
    fireEvent.click(screen.getByRole("button", { name: "下游待核实" }));
    expect(await screen.findByText(/历史版本及未加载的引用尚未核实/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "版本" })).toBeInTheDocument();
    expect(screen.getByText("coupon_used_count")).toBeInTheDocument();
    const actions = container.querySelector<HTMLElement>("[class*=actions]");
    expect(actions).not.toBeNull();
    expect(within(actions!).getByRole("button", { name: "试算" })).toBeEnabled();
    expect(await within(actions!).findByRole("button", { name: "绑定逻辑属性" })).toBeEnabled();
    expect(within(actions!).getByRole("button", { name: "创建新版本草稿" })).toBeInTheDocument();

    fireEvent.click(within(actions!).getByRole("button", { name: "试算" }));
    expect(screen.getByTestId("metric-trial-drawer")).toHaveAttribute("data-mode", "published");
    fireEvent.click(screen.getByRole("button", { name: "Run trial" }));
    expect(mocks.queryMetric).toHaveBeenCalledWith("network-1", "metric-1", 1, {});
    expect(mocks.trialMetric).not.toHaveBeenCalled();
    fireEvent.click(within(actions!).getByRole("button", { name: "绑定逻辑属性" }));
    const bindingDialog = await screen.findByRole("dialog", {
      name: "绑定为销售订单对象类逻辑属性",
    });
    expect(bindingDialog).toBeInTheDocument();
    expect(within(bindingDialog).queryByText("逻辑属性随实例按需计算")).not.toBeInTheDocument();
    expect(within(bindingDialog).getByText("属性名称")).toBeInTheDocument();
  });

  it("hides the logical-property action for an object-set metric", async () => {
    mocks.getObjectMetricV1.mockResolvedValue(record("published", "object_set"));

    render(<ObjectMetricDetailScene />);

    expect(await screen.findByRole("heading", { name: "已用券次数" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "试算" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "绑定逻辑属性" })).not.toBeInTheDocument();
    expect(screen.queryByText("仅适用于单个实例")).not.toBeInTheDocument();
  });

  it("shows one bound property and its pinned version on a newer published release", async () => {
    const metric = record("published", "object_instance");
    metric.definition.version = 2;
    mocks.getObjectMetricV1.mockResolvedValue(metric);
    mocks.getObjectTypeDetail.mockResolvedValue({
      id: "order",
      name: "销售订单",
      dataProperties: [],
      logicProperties: [
        {
          name: "used_count",
          displayName: "已用次数",
          metricBinding: { metric_ref: { metric_id: "metric-1", version: 1 } },
        },
      ],
    });
    render(<ObjectMetricDetailScene />);
    expect(await screen.findByText(/已用次数 · v1/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "绑定逻辑属性" })).not.toBeInTheDocument();
    mocks.upgradeMetric.mockResolvedValue({});
    fireEvent.click(screen.getByRole("button", { name: "升级绑定版本" }));
    await screen.findByText("升级逻辑属性绑定");
    const confirmation = await screen.findByRole("dialog");
    expect(mocks.upgradeMetric).not.toHaveBeenCalled();
    fireEvent.click(within(confirmation).getByRole("button", { name: "升级绑定版本" }));
    await waitFor(() => {
      expect(mocks.upgradeMetric).toHaveBeenCalledWith("network-1", "metric-1", "used_count", 2);
    });
  });

  it("does not mistake a failed object-type lookup for an unbound metric", async () => {
    mocks.getObjectMetricV1.mockResolvedValue(record("published", "object_instance"));
    mocks.getObjectTypeDetail.mockRejectedValue(new Error("lookup unavailable"));
    render(<ObjectMetricDetailScene />);
    expect(await screen.findByText(/状态未知/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "绑定逻辑属性" })).not.toBeInTheDocument();
  });

  it.each(["draft", "validated"] as const)(
    "trials a %s definition without requiring publication or enabling binding",
    async (status) => {
      const draftRecord = record(status, "object_instance");
      mocks.getObjectMetricV1.mockResolvedValue(draftRecord);

      render(<ObjectMetricDetailScene />);

      expect(await screen.findByRole("heading", { name: "已用券次数" })).toBeInTheDocument();
      const trialButton = screen.getByRole("button", { name: "试算" });
      expect(trialButton).toBeEnabled();
      expect(screen.queryByRole("button", { name: "绑定逻辑属性" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "编辑" })).toBeInTheDocument();

      fireEvent.click(trialButton);
      expect(screen.getByTestId("metric-trial-drawer")).toHaveAttribute("data-mode", "draft");
      fireEvent.click(screen.getByRole("button", { name: "Run trial" }));
      expect(mocks.trialMetric).toHaveBeenCalledWith("network-1", draftRecord.definition, {});
      expect(mocks.queryMetric).not.toHaveBeenCalled();
    },
  );

  it("defaults to the latest published release and continues an existing working draft", async () => {
    const draft = record("draft", "object_instance");
    draft.definition.version = 3;
    const published = record("published", "object_instance");
    published.definition.version = 2;
    const older = record("published", "object_instance");
    mocks.getObjectMetricV1.mockResolvedValue(draft);
    mocks.listVersions.mockResolvedValue([older, draft, published]);

    render(<ObjectMetricDetailScene />);

    expect(await screen.findByRole("button", { name: "编辑" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "版本" }).closest(".ant-select")).toHaveTextContent(
      "v2 · 已发布",
    );
    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith(
        "/knowledge-network/workspace/network-1/metrics/metric-1/edit",
        {
          state: {
            knowledgeNetworkReturnTo:
              "/knowledge-network/workspace/network-1/metrics?objectTypeId=order",
          },
        },
      );
    });
    expect(mocks.createNextDraft).not.toHaveBeenCalled();

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "版本" }));
    expect(await screen.findByText("草稿 · 基于 v2")).toBeInTheDocument();
    expect(screen.queryByText("v3 · 草稿")).not.toBeInTheDocument();
  });

  it("creates a working draft only after an explicit action", async () => {
    const published = record("published", "object_instance");
    mocks.getObjectMetricV1.mockResolvedValue(published);
    mocks.listVersions.mockResolvedValue([published]);
    mocks.createNextDraft.mockResolvedValue(record("draft", "object_instance"));

    render(<ObjectMetricDetailScene />);

    const createDraft = await screen.findByRole("button", {
      name: "创建新版本草稿",
    });
    expect(mocks.createNextDraft).not.toHaveBeenCalled();
    fireEvent.click(createDraft);
    await waitFor(() => {
      expect(mocks.createNextDraft).toHaveBeenCalledWith("network-1", "metric-1");
      expect(mocks.navigate).toHaveBeenCalledWith(
        "/knowledge-network/workspace/network-1/metrics/metric-1/edit",
        {
          state: {
            knowledgeNetworkReturnTo:
              "/knowledge-network/workspace/network-1/metrics?objectTypeId=order",
          },
        },
      );
    });
  });

  it("returns to the exact originating metric list instead of the default object", async () => {
    const returnTo =
      "/knowledge-network/workspace/network-1/metrics?objectTypeId=customer&view=list&metricPage=2";
    mocks.locationState.current = { knowledgeNetworkReturnTo: returnTo };
    mocks.getObjectMetricV1.mockResolvedValue(record("published", "object_instance"));

    render(<ObjectMetricDetailScene />);

    fireEvent.click(await screen.findByRole("button", { name: "返回列表" }));
    expect(mocks.navigate).toHaveBeenCalledWith(returnTo);
  });

  it("opens a referenced metric at its pinned version and restores a linked historic version", async () => {
    const latest = record("published", "object_instance");
    latest.definition.version = 2;
    const historic = record("published", "object_instance");
    historic.definition.version = 1;
    mocks.getObjectMetricV1.mockImplementation((_networkId, _metricId, version) =>
      Promise.resolve(version === 1 ? historic : latest),
    );
    mocks.listVersions.mockResolvedValue([latest, historic]);
    mocks.locationSearch.current = "?version=1";

    render(<ObjectMetricDetailScene />);

    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "版本" }).closest(".ant-select"),
      ).toHaveTextContent("v1 · 已发布"),
    );
    expect(mocks.getObjectMetricV1).toHaveBeenCalledWith("network-1", "metric-1", 1, {
      skipErrorToast: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "Open related metric" }));
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/knowledge-network/workspace/network-1/metrics/base-metric/detail?version=1",
      {
        state: {
          knowledgeNetworkReturnTo:
            "/knowledge-network/workspace/network-1/metrics?objectTypeId=order",
        },
      },
    );
  });

  it("does not silently replace an unavailable pinned version with the latest release", async () => {
    const latest = record("published", "object_instance");
    latest.definition.version = 2;
    mocks.getObjectMetricV1.mockResolvedValue(latest);
    mocks.locationSearch.current = "?version=1";

    render(<ObjectMetricDetailScene />);

    expect(await screen.findByText("指标不存在")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "已用券次数" })).not.toBeInTheDocument();
  });
});
