/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  businessInfoOf,
  compareToolsInBusinessGroup,
} from "@/modules/knowledge-network/scenes/context-loader-tool-business-info";
import type { ContextLoaderOp } from "@/modules/knowledge-network/services/context-loader.service";

function op(id: string, summary = id): ContextLoaderOp {
  return { id, group: "test", summary, path: "/test", query: [], body: {} };
}

describe("businessInfoOf", () => {
  it("assigns lifecycle tools distinct Chinese business names", () => {
    expect(businessInfoOf(op("bkn_start_interaction"))).toEqual({ groupKey: "lifecycle", name: "开始交互" });
    expect(businessInfoOf(op("bkn_finish_interaction"))).toEqual({ groupKey: "lifecycle", name: "结束交互" });
    expect(businessInfoOf(op("bkn_get_operation"))).toEqual({ groupKey: "lifecycle", name: "查看操作状态" });
    expect(businessInfoOf(op("list_action_execution"))).toEqual({ groupKey: "logic", name: "行动执行记录" });
    expect(businessInfoOf(op("query_metric"))).toEqual({ groupKey: "logic", name: "指标数据查询" });
  });

  it("keeps an unknown lifecycle tool in the lifecycle group", () => {
    expect(businessInfoOf(op("bkn_archive_interaction", "Archive an interaction"))).toEqual({
      groupKey: "lifecycle",
      name: "Archive an interaction",
    });
  });

  it("does not classify bkn names as knowledge-network tools", () => {
    expect(businessInfoOf(op("bkn_unknown"))).not.toMatchObject({ groupKey: "network" });
    expect(businessInfoOf(op("search_schema"))).toEqual({ groupKey: "model", name: "语义检索" });
  });

  it("orders lifecycle tools from start to finish", () => {
    const tools = [op("bkn_finish_interaction"), op("bkn_start_interaction")];
    expect(tools.sort((left, right) => compareToolsInBusinessGroup("lifecycle", left, right)).map((tool) => tool.id)).toEqual([
      "bkn_start_interaction",
      "bkn_finish_interaction",
    ]);
  });
});
