/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { ObjectMetricRecordV1 } from "@/modules/knowledge-network/types/object-metric";

const mocks = vi.hoisted(() => ({
  listObjectTypes: vi.fn(),
  listObjectMetrics: vi.fn(),
  navigate: vi.fn(),
  setPageSize: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, values?: { total?: number }) =>
      key === "common.total" ? `total:${values?.total ?? 0}` : key,
  }),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => mocks.navigate,
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { error: vi.fn(), success: vi.fn() },
  }),
}));

vi.mock("@/modules/knowledge-network/components/shared/usePersistentPageSize", () => ({
  usePersistentPageSize: () => [10, mocks.setPageSize],
}));

vi.mock("@/modules/knowledge-network/components/object-metric/ObjectMetricGraphCanvas", () => ({
  ObjectMetricGraphCanvas: () => <div>metric graph</div>,
}));

vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  createNextObjectMetricDraftV1: vi.fn(),
  deleteObjectMetricDraftV1: vi.fn(),
  deprecateObjectMetricV1: vi.fn(),
  listObjectMetricsV1: mocks.listObjectMetrics,
}));
vi.mock("@/modules/knowledge-network/services/object-type.service", () => ({
  listKnowledgeNetworkObjectTypePage: mocks.listObjectTypes,
}));

import { ObjectMetricListPanel } from "./ObjectMetricListPanel";

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
  mocks.listObjectTypes.mockReset();
  mocks.listObjectMetrics.mockReset();
  mocks.navigate.mockReset();
  mocks.setPageSize.mockReset();
});

function metric(index: number): ObjectMetricRecordV1 {
  return {
    branch: "main",
    create_time: 1,
    creator: { id: "tester", type: "user" },
    definition: {
      calculation_scope: "object_set",
      code: `order_metric_${index}`,
      description: `Metric ${index}`,
      id: `metric-${index}`,
      lifecycle: {
        aggregation_registry_version: "1.0",
        expression_language_version: "1.0",
        function_registry_version: "1.0",
        ontology_version: "current",
        status: "published",
        unit_registry_version: "1.0",
      },
      metric_type: "atomic",
      name: `订单指标 ${index}`,
      owner_object_type_id: "order",
      query_capabilities: { analysis_dimensions: [], time_dimensions: [] },
      result_semantics: {
        no_data_policy: "zero",
        partial_data_policy: "reject",
        statistical_grain: { group_by_dimensions: [] },
        value: { physical_type: "int64", semantic_type: "count" },
      },
      specification: { kind: "atomic", measure: { aggregation: "count_rows" } },
      version: 1,
    },
    kn_id: "network-1",
    update_time: 1,
    updater: { id: "tester", type: "user" },
  };
}

describe("ObjectMetricListPanel pagination", () => {
  it("requests the selected list page from the server", async () => {
    const records = Array.from({ length: 25 }, (_, index) => metric(index + 1));
    mocks.listObjectTypes.mockResolvedValue({
      entries: [{ id: "order", name: "订单" }],
      totalCount: 1,
    });
    mocks.listObjectMetrics.mockImplementation(
      (_networkId: string, query: { limit?: number; offset?: number }) => {
        const offset = query.offset ?? 0;
        const limit = query.limit ?? 10;
        return Promise.resolve({
          entries: records.slice(offset, offset + limit),
          total_count: records.length,
        });
      },
    );

    const { container } = render(<ObjectMetricListPanel canModify={false} networkId="network-1" />);

    expect(container.querySelector('[class*="toolbarLeft"] .ant-segmented')).not.toBeNull();
    expect(container.querySelector('[class*="toolbarRight"] .ant-segmented')).toBeNull();

    await waitFor(() => {
      expect(mocks.listObjectTypes).toHaveBeenCalledWith(
        "network-1",
        expect.objectContaining({ limit: 20, offset: 0 }),
        { skipErrorToast: true },
      );
    });
    await waitFor(() => {
      expect(screen.getByLabelText("订单有 25 个指标").textContent).toBe("25");
    });
    fireEvent.click(screen.getByText(/^(列表|list)$/i));

    await waitFor(() => {
      expect(mocks.listObjectMetrics).toHaveBeenCalledWith("network-1", {
        keyword: undefined,
        limit: 10,
        metricType: undefined,
        offset: 0,
        ownerObjectTypeId: "order",
      });
    });
    expect(await screen.findByText("订单指标 1")).not.toBeNull();
    expect(screen.queryByText("订单指标 11")).toBeNull();
    expect(screen.getByText("订单指标 1").getAttribute("title")).toBe("订单指标 1");
    expect(screen.queryByText("order_metric_1@v1")).toBeNull();
    expect(screen.getByText("total:25")).not.toBeNull();

    expect(container.querySelectorAll(".ant-table-tbody > tr.ant-table-row")).toHaveLength(10);
    fireEvent.click(screen.getByTitle("2"));

    await waitFor(() => {
      expect(mocks.listObjectMetrics).toHaveBeenCalledWith("network-1", {
        keyword: undefined,
        limit: 10,
        metricType: undefined,
        offset: 10,
        ownerObjectTypeId: "order",
      });
    });
    expect(await screen.findByText("订单指标 11")).not.toBeNull();
    expect(screen.queryByText("订单指标 1")).toBeNull();
    expect(container.querySelectorAll(".ant-table-tbody > tr.ant-table-row")).toHaveLength(10);

    const objectList = container.querySelector<HTMLElement>("[class*=objectList]");
    expect(objectList).not.toBeNull();
    objectList!.scrollTop = 200;
    fireEvent.change(screen.getByPlaceholderText("搜索当前对象的指标名称或编码"), {
      target: { value: "订单指标 2" },
    });
    await waitFor(() => {
      expect(mocks.listObjectMetrics).toHaveBeenCalledWith("network-1", {
        keyword: "订单指标 2",
        limit: 10,
        metricType: undefined,
        offset: 0,
        ownerObjectTypeId: "order",
      });
    });
  });

  it("pages a large object catalog and searches it on the server without loading metrics", async () => {
    mocks.listObjectMetrics.mockResolvedValue({ entries: [], total_count: 0 });
    mocks.listObjectTypes.mockImplementation(
      (_networkId: string, query: { limit: number; offset: number; namePattern?: string }) =>
        Promise.resolve({
          entries: Array.from({ length: query.namePattern ? 2 : 20 }, (_, index) => ({
            id: `object-${query.offset + index}`,
            name: query.namePattern ? `目标对象 ${index + 1}` : `对象 ${query.offset + index}`,
          })),
          totalCount: query.namePattern ? 2 : 10000,
        }),
    );

    const { container } = render(<ObjectMetricListPanel canModify={false} networkId="network-1" />);

    await waitFor(() => {
      expect(container.querySelectorAll("[class*=objectButton]")).toHaveLength(20);
    });
    expect(screen.getByText(/10000/)).not.toBeNull();
    await waitFor(() => expect(mocks.listObjectMetrics).toHaveBeenCalledTimes(20));
    expect(mocks.listObjectMetrics).toHaveBeenCalledWith(
      "network-1",
      { limit: 1, offset: 0, ownerObjectTypeId: "object-0" },
      { skipErrorToast: true },
    );
    expect(screen.getByLabelText("对象 0有 0 个指标").textContent).toBe("0");

    const objectList = container.querySelector<HTMLElement>("[class*=objectList]")!;
    objectList.scrollTop = 200;
    fireEvent.change(screen.getByPlaceholderText("搜索对象类"), { target: { value: "目标" } });
    expect(objectList.scrollTop).toBe(0);
    await waitFor(() => {
      expect(mocks.listObjectTypes).toHaveBeenCalledWith(
        "network-1",
        expect.objectContaining({ limit: 20, namePattern: "目标", offset: 0 }),
        { skipErrorToast: true },
      );
    });
    expect(await screen.findByTitle("目标对象 2")).not.toBeNull();
    fireEvent.click(screen.getByTitle("目标对象 2"));
    expect(container.querySelector('[class*="toolbarLeft"] strong')?.textContent).toBe(
      "目标对象 2",
    );
  });

  it("collapses the object catalog and restores it without losing the current selection", async () => {
    mocks.listObjectTypes.mockResolvedValue({
      entries: [{ id: "order", name: "销售订单" }],
      totalCount: 1,
    });
    mocks.listObjectMetrics.mockResolvedValue({ entries: [], total_count: 22 });

    const { container } = render(<ObjectMetricListPanel canModify={false} networkId="network-1" />);

    expect(await screen.findByTitle("销售订单")).not.toBeNull();
    expect(container.querySelector(".ant-pagination")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "收起对象类列表" }));
    expect(screen.queryByPlaceholderText("搜索对象类")).toBeNull();
    expect(screen.getByRole("button", { name: "展开对象类列表" })).not.toBeNull();
    expect(container.querySelector('[class*="toolbarLeft"] strong')?.textContent).toBe("销售订单");

    fireEvent.click(screen.getByRole("button", { name: "展开对象类列表" }));
    expect(screen.getByPlaceholderText("搜索对象类")).not.toBeNull();
    expect(screen.getByTitle("销售订单")).not.toBeNull();
  });

  it("limits count requests to four in flight and distinguishes a pending count from zero", async () => {
    const resolveCounts: Array<(value: { entries: []; total_count: number }) => void> = [];
    mocks.listObjectTypes.mockResolvedValue({
      entries: Array.from({ length: 20 }, (_, index) => ({
        id: `object-${index}`,
        name: `对象 ${index}`,
      })),
      totalCount: 20,
    });
    mocks.listObjectMetrics.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCounts.push(resolve);
        }),
    );

    render(<ObjectMetricListPanel canModify={false} networkId="network-1" />);

    await waitFor(() => expect(mocks.listObjectMetrics).toHaveBeenCalledTimes(4));
    expect(screen.getByTitle("对象 0").textContent).toContain("…");
    resolveCounts[0]({ entries: [], total_count: 7 });
    await waitFor(() => {
      expect(screen.getByLabelText("对象 0有 7 个指标").textContent).toBe("7");
      expect(mocks.listObjectMetrics).toHaveBeenCalledTimes(5);
    });
  });
});
