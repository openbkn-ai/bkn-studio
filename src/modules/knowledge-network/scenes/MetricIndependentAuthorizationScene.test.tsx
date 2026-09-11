/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MetricDataQueryScene } from "@/modules/knowledge-network/scenes/MetricDataQueryScene";
import { MetricDetailScene } from "@/modules/knowledge-network/scenes/MetricDetailScene";

const serviceMocks = vi.hoisted(() => ({
  deleteMetric: vi.fn(),
  getMetric: vi.fn(),
  getObjectTypeDetail: vi.fn(),
  listObjectTypes: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return { ...actual, useTranslation: () => ({ t: (key: string) => key }) };
});

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { success: vi.fn() },
    modal: { confirm: vi.fn() },
  }),
}));

vi.mock("@/modules/knowledge-network/hooks/useAccountDirectory", () => ({
  useResolvedUpdaterName: (name?: string) => name ?? "--",
}));

vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  deleteKnowledgeNetworkMetric: serviceMocks.deleteMetric,
  getKnowledgeNetworkMetric: serviceMocks.getMetric,
  getKnowledgeNetworkObjectTypeDetail: serviceMocks.getObjectTypeDetail,
  listKnowledgeNetworkObjectTypes: serviceMocks.listObjectTypes,
}));

vi.mock("@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceConfigShell", () => ({
  KnowledgeNetworkResourceConfigShell: ({ children, title }: { children?: ReactNode; title: string }) => (
    <main><h1>{title}</h1>{children}</main>
  ),
}));

vi.mock("@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceDetailActions", () => ({
  KnowledgeNetworkResourceDetailActions: () => null,
}));

vi.mock("@/modules/knowledge-network/components/shared/KnowledgeNetworkObjectAuthorizeDrawer", () => ({
  KnowledgeNetworkObjectAuthorizeDrawer: () => null,
}));

vi.mock("@/modules/knowledge-network/components/metric/MetricDataQueryPanel", () => ({
  MetricDataQueryPanel: ({ propertyOptions }: { propertyOptions?: Array<{ name: string }> }) => (
    <div data-testid="metric-query-fields">{propertyOptions?.map((item) => item.name).join(",")}</div>
  ),
}));

const metric = {
  calculationFormula: {
    aggregation: { aggr: "sum" as const, property: "amount" },
    analysisDimensions: ["region"],
  },
  dependencyProperties: [
    { displayName: "Amount", name: "amount", type: "double" },
    { displayName: "Region", name: "region", type: "string" },
  ],
  description: "",
  id: "metric-1",
  metricType: "atomic" as const,
  name: "Sales",
  operations: ["view_detail", "query_data"],
  scopeName: "Orders",
  scopeRef: "orders",
  scopeType: "object_type" as const,
  tags: [],
  updateTime: "",
  updaterName: "Owner",
};

beforeEach(() => {
  serviceMocks.getMetric.mockResolvedValue(metric);
  serviceMocks.getObjectTypeDetail.mockRejectedValue(new Error("forbidden"));
  serviceMocks.listObjectTypes.mockRejectedValue(new Error("forbidden"));
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      addEventListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("metric independent authorization scenes", () => {
  it.each([
    ["detail", <MetricDetailScene key="detail" metricId="metric-1" networkId="kn-1" />, "Sales"],
    [
      "query",
      <MetricDataQueryScene key="query" metricId="metric-1" networkId="kn-1" />,
      "knowledgeNetwork.metricDataQueryTitle",
    ],
  ])("loads the %s scene without any object-type request", async (_name, scene, readyText) => {
    render(<MemoryRouter>{scene}</MemoryRouter>);

    await waitFor(() => expect(screen.getAllByText(readyText).length).toBeGreaterThan(0));
    expect(serviceMocks.getMetric).toHaveBeenCalledWith("kn-1", "metric-1");
    expect(serviceMocks.getObjectTypeDetail).not.toHaveBeenCalled();
    expect(serviceMocks.listObjectTypes).not.toHaveBeenCalled();
  });
});
