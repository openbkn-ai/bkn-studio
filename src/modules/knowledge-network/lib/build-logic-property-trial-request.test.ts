/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  buildLogicPropertyTrialAdditionalContext,
  buildLogicPropertyTrialBody,
  buildLogicPropertyTrialQuery,
} from "@/modules/knowledge-network/lib/build-logic-property-trial-request";
import type { ObjectTypeLogicProperty } from "@/modules/knowledge-network/types/knowledge-network";

const gmvMetric: ObjectTypeLogicProperty = {
  dataSource: { id: "metric-1", name: "GMV", type: "metric" },
  displayName: "GMV指标",
  name: "lp_gmv_metric",
  type: "metric",
};

const discountRate: ObjectTypeLogicProperty = {
  displayName: "订单折扣率",
  name: "lp_order_discount_rate",
  type: "metric",
};

describe("buildLogicPropertyTrialQuery", () => {
  it("joins display names into the query", () => {
    expect(buildLogicPropertyTrialQuery([gmvMetric, discountRate])).toBe(
      "查询选中实例的GMV指标、订单折扣率当前值",
    );
  });

  it("falls back to property name when display name is blank", () => {
    expect(
      buildLogicPropertyTrialQuery([{ displayName: "  ", name: "lp_foo", type: "metric" }]),
    ).toBe("查询选中实例的lp_foo当前值");
  });

  it("uses a generic query when no properties are given", () => {
    expect(buildLogicPropertyTrialQuery([])).toBe("查询选中实例的逻辑属性当前值");
  });
});

describe("buildLogicPropertyTrialAdditionalContext", () => {
  it("includes instant hint for metric properties and the first identity sample", () => {
    expect(
      buildLogicPropertyTrialAdditionalContext([gmvMetric], [{ order_id: 10357 }]),
    ).toBe(
      "对象类详情页实例试算。instant=true；metric 型按即时汇总/当前值查询，不输出趋势 step。试算属性：lp_gmv_metric。实例主键示例：{\"order_id\":10357}。",
    );
  });

  it("omits instant hint when there are no metric properties", () => {
    expect(
      buildLogicPropertyTrialAdditionalContext(
        [{ displayName: "Weather", name: "weather", type: "tool" }],
        [{ city_id: "bj" }],
      ),
    ).toBe('对象类详情页实例试算。试算属性：weather。实例主键示例：{"city_id":"bj"}。');
  });
});

describe("buildLogicPropertyTrialBody", () => {
  it("builds the resolver request body with optional debug", () => {
    expect(
      buildLogicPropertyTrialBody({
        instanceIdentities: [{ order_id: "1001" }],
        knId: "kn_demo",
        logicProperties: [gmvMetric],
        objectTypeId: "ot_orders",
        returnDebug: true,
      }),
    ).toEqual({
      _instance_identities: [{ order_id: "1001" }],
      additional_context:
        '对象类详情页实例试算。instant=true；metric 型按即时汇总/当前值查询，不输出趋势 step。试算属性：lp_gmv_metric。实例主键示例：{"order_id":"1001"}。',
      kn_id: "kn_demo",
      ot_id: "ot_orders",
      options: { return_debug: true },
      properties: ["lp_gmv_metric"],
      query: "查询选中实例的GMV指标当前值",
    });
  });
});
