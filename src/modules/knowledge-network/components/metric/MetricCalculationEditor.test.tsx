/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Form } from "antd";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MetricCalculationEditor } from "@/modules/knowledge-network/components/metric/MetricCalculationEditor";
import type {
  KnowledgeNetworkObjectTypeRecord,
  ObjectTypeDataProperty,
} from "@/modules/knowledge-network/types/knowledge-network";

const serviceMocks = vi.hoisted(() => ({
  getDependencyProperties: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return { ...actual, useTranslation: () => ({ t: (key: string) => key }) };
});

vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  getKnowledgeNetworkMetricDependencyProperties: serviceMocks.getDependencyProperties,
}));

vi.mock("@/modules/knowledge-network/components/action-type/ActionTypeConditionEditor", () => ({
  ActionTypeConditionEditor: () => null,
}));

function objectType(
  id: string,
  operations: string[],
): KnowledgeNetworkObjectTypeRecord {
  return {
    color: "#2f54eb",
    conceptGroupIds: [],
    conceptGroupNames: [],
    description: "",
    hasIndex: false,
    id,
    name: id,
    operations,
    tags: [],
    updateTime: "",
    updaterName: "",
  };
}

const objectTypes = [
  objectType("loadable", ["view_detail", "query_data"]),
  objectType("fallback", []),
];
const fallbackProperties: ObjectTypeDataProperty[] = [
  {
    displayKey: false,
    displayName: "Existing field",
    incrementalKey: false,
    name: "existing_field",
    primaryKey: false,
    type: "string",
  },
];

function TestEditor({ objectTypeId }: { objectTypeId: string }) {
  const [form] = Form.useForm();
  return (
    <Form form={form}>
      <MetricCalculationEditor
        embedded
        fallbackProperties={fallbackProperties}
        form={form}
        networkId="kn-1"
        objectTypeId={objectTypeId}
        objectTypes={objectTypes}
      />
    </Form>
  );
}

beforeEach(() => {
  serviceMocks.getDependencyProperties.mockReturnValue(new Promise(() => undefined));
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

describe("MetricCalculationEditor", () => {
  it("clears loading when switching from a loadable object type to a fallback option", async () => {
    const { rerender } = render(<TestEditor objectTypeId="loadable" />);
    const aggregationItem = screen
      .getByText("knowledgeNetwork.metricAggregationProperty")
      .closest(".ant-form-item");

    await waitFor(() => {
      expect(serviceMocks.getDependencyProperties).toHaveBeenCalledWith("kn-1", "loadable");
      expect(aggregationItem?.querySelector(".ant-select-loading")).toBeTruthy();
    });

    rerender(<TestEditor objectTypeId="fallback" />);

    await waitFor(() => {
      expect(aggregationItem?.querySelector(".ant-select-loading")).toBeNull();
    });
  });
});
