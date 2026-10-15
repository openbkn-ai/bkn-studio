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
    message: { success: vi.fn() },
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
  listKnowledgeNetworkObjectTypes: vi.fn().mockResolvedValue([
    {
      id: "order",
      name: "订单",
    },
  ]),
  listKnowledgeNetworkRelationTypes: vi.fn().mockResolvedValue([]),
  listObjectMetricsV1: mocks.listObjectMetrics,
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
    mocks.listObjectMetrics.mockImplementation(
      (_networkId: string, query: { limit?: number; offset?: number }) => {
        if (query.limit === 500) {
          return Promise.resolve({ entries: records, total_count: records.length });
        }
        const offset = query.offset ?? 0;
        const limit = query.limit ?? 10;
        return Promise.resolve({
          entries: records.slice(offset, offset + limit),
          total_count: records.length,
        });
      },
    );

    const { container } = render(<ObjectMetricListPanel canModify={false} networkId="network-1" />);

    await waitFor(() => {
      expect(mocks.listObjectMetrics).toHaveBeenCalledWith("network-1", {
        limit: 500,
        offset: 0,
      });
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
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "订单指标 2" } });
    expect(objectList!.scrollTop).toBe(0);
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

  it("loads every metric page for the graph and object counts", async () => {
    const records = Array.from({ length: 501 }, (_, index) => metric(index + 1));
    mocks.listObjectMetrics.mockImplementation(
      (_networkId: string, query: { limit?: number; offset?: number }) => {
        const offset = query.offset ?? 0;
        const limit = query.limit ?? 500;
        return Promise.resolve({
          entries: records.slice(offset, offset + limit),
          total_count: records.length,
        });
      },
    );

    render(<ObjectMetricListPanel canModify={false} networkId="network-1" />);

    await waitFor(() => {
      expect(mocks.listObjectMetrics).toHaveBeenCalledWith("network-1", {
        limit: 500,
        offset: 500,
      });
    });
    expect(await screen.findByText("501")).not.toBeNull();
  });
});
