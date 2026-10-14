/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import i18n from "@/app/locales/i18n";
import { ObjectMetricLineagePanel } from "@/modules/knowledge-network/components/object-metric/ObjectMetricLineagePanel";
import type { ObjectMetricRecordV1 } from "@/modules/knowledge-network/types/object-metric";
import type { ObjectTypeLogicProperty } from "@/modules/knowledge-network/types/object-type";

function metric(
  id: string,
  name: string,
  specification: ObjectMetricRecordV1["definition"]["specification"],
): ObjectMetricRecordV1 {
  return {
    branch: "main",
    create_time: 0,
    creator: { id: "test", type: "user" },
    definition: {
      calculation_scope: "object_set",
      code: id,
      description: "",
      id,
      lifecycle: {
        aggregation_registry_version: "v1",
        expression_language_version: "v1",
        function_registry_version: "v1",
        ontology_version: "v1",
        status: "published",
        unit_registry_version: "v1",
      },
      metric_type: specification.kind,
      name,
      owner_object_type_id: "order",
      query_capabilities: { analysis_dimensions: [], time_dimensions: [] },
      result_semantics: {
        no_data_policy: "zero",
        partial_data_policy: "reject",
        statistical_grain: { group_by_dimensions: [] },
        value: { physical_type: "int64", semantic_type: "count" },
      },
      specification,
      version: 1,
    },
    kn_id: "test-network",
    update_time: 0,
    updater: { id: "test", type: "user" },
  };
}

describe("ObjectMetricLineagePanel", () => {
  it("updates visible copy when the language changes", async () => {
    const current = metric("order_count", "Order count", {
      kind: "atomic",
      measure: { aggregation: "count_rows" },
    });
    try {
      await i18n.changeLanguage("zh-CN");
      render(<ObjectMetricLineagePanel logicProperties={[]} metric={current} metrics={[]} />);
      expect(screen.getByRole("region", { name: "指标血缘" })).toBeInTheDocument();
      await act(async () => {
        await i18n.changeLanguage("en-US");
      });
      expect(screen.getByRole("region", { name: "Metric lineage" })).toBeInTheDocument();
    } finally {
      await i18n.changeLanguage("zh-CN");
    }
  });

  it("keeps impact counts visible without rendering a persistent warning alert", () => {
    const current = metric("order_count", "订单数", {
      kind: "atomic",
      measure: { aggregation: "count_rows" },
    });
    const downstream = metric("completed_order_count", "已完成订单数", {
      base_metric: { metric_id: current.definition.id, version: 1 },
      business_qualifiers: {},
      kind: "derived",
    });
    const logicProperties: ObjectTypeLogicProperty[] = [
      {
        dataSource: {
          id: `object_metric_v1:${current.definition.id}@${current.definition.version}`,
          type: "metric",
        },
        displayName: "订单数",
        name: "order_count",
      },
    ];

    render(
      <ObjectMetricLineagePanel
        logicProperties={logicProperties}
        metric={current}
        metrics={[downstream]}
      />,
    );

    expect(screen.getByText("下游 1")).toBeInTheDocument();
    expect(screen.getByText("逻辑属性 1")).toBeInTheDocument();
    expect(screen.getByText("已完成订单数")).toBeInTheDocument();
    expect(screen.getByText("订单数 · order_count")).toBeInTheDocument();
    expect(screen.queryByText("影响分析")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
