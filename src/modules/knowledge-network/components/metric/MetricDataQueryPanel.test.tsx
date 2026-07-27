/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MetricDataQueryPanel } from "@/modules/knowledge-network/components/metric/MetricDataQueryPanel";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();

  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
    }),
  };
});

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: {
      error: vi.fn(),
      success: vi.fn(),
    },
  }),
}));

vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  queryKnowledgeNetworkMetricData: vi.fn(),
}));

vi.mock("@/modules/knowledge-network/components/action-type/ActionTypeConditionEditor", () => ({
  ActionTypeConditionEditor: () => <div data-testid="metric-filter-condition-editor" />,
}));

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
});

describe("MetricDataQueryPanel", () => {
  it("renders drill-down dimensions with semantic property names", () => {
    const { container } = render(
      <MetricDataQueryPanel
        analysisDimensionOptions={["material_name"]}
        boundObjectTypeId="material_entity"
        metricId="metric-1"
        metricName="Material count"
        networkId="network-1"
        propertyOptions={[
          {
            displayName: "物料名称",
            label: "物料名称",
            name: "material_name",
            type: "string",
            value: "material_name",
          },
        ]}
      />,
    );

    const drillDownLabel = screen.getByText("knowledgeNetwork.metricQueryAnalysisDimensions");
    const drillDownSelect = drillDownLabel
      .closest(".ant-form-item")
      ?.querySelector(".ant-select-selector");

    expect(drillDownSelect).toBeTruthy();
    fireEvent.mouseDown(drillDownSelect!);

    expect(drillDownLabel).toBeTruthy();
    expect(screen.getByText("物料名称")).toBeTruthy();
    expect(container.textContent).not.toContain("material_name");
  });

  it("keeps filter condition available when no drill-down dimensions are configured", () => {
    render(
      <MetricDataQueryPanel
        analysisDimensionOptions={[]}
        boundObjectTypeId="material_entity"
        metricId="metric-1"
        metricName="Material count"
        networkId="network-1"
        objectTypes={[
          {
            conceptGroupIds: [],
            conceptGroupNames: [],
            color: "#1677ff",
            description: "",
            hasIndex: false,
            id: "material_entity",
            name: "Material",
            tags: [],
            updateTime: "",
            updaterName: "",
          },
        ]}
        propertyOptions={[
          {
            displayName: "Status",
            label: "Status",
            name: "status",
            type: "string",
            value: "status",
          },
        ]}
      />,
    );

    expect(screen.queryByText("knowledgeNetwork.metricQueryAnalysisDimensions")).toBeNull();
    expect(screen.getByText("knowledgeNetwork.metricFilterCondition")).toBeTruthy();
    expect(screen.getByTestId("metric-filter-condition-editor")).toBeTruthy();
  });
});
