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
  it("assigns lifecycle tools distinct localizable business names", () => {
    expect(businessInfoOf(op("bkn_start_interaction"))).toEqual({
      groupKey: "lifecycle",
      nameKey: "knowledgeNetwork.contextLoaderPanel.toolNames.bkn_start_interaction",
      name: "Start Interaction",
    });
    expect(businessInfoOf(op("bkn_finish_interaction"))).toMatchObject({ groupKey: "lifecycle", name: "Finish Interaction" });
    expect(businessInfoOf(op("bkn_get_operation"))).toMatchObject({ groupKey: "lifecycle", name: "View Operation Status" });
    expect(businessInfoOf(op("list_action_execution"))).toMatchObject({ groupKey: "logic", name: "Action Execution History" });
    expect(businessInfoOf(op("query_metric"))).toMatchObject({ groupKey: "logic", name: "Metric Data Query" });
    expect(businessInfoOf(op("list_skills"))).toMatchObject({ groupKey: "skill", name: "Skill List" });
    expect(businessInfoOf(op("get_skill_content"))).toMatchObject({ groupKey: "skill", name: "View Skill Content" });
    expect(businessInfoOf(op("read_skill_file"))).toMatchObject({ groupKey: "skill", name: "Read Skill File" });
  });

  it("keeps an unknown lifecycle tool in the lifecycle group with a compact fallback name", () => {
    expect(businessInfoOf(op("bkn_archive_interaction", "Archive an interaction"))).toEqual({
      groupKey: "lifecycle",
      nameKey: "knowledgeNetwork.contextLoaderPanel.toolNames.fallbackLifecycle",
      name: "Interaction Lifecycle Tool",
    });
  });

  it("does not classify bkn names as knowledge-network tools", () => {
    expect(businessInfoOf(op("bkn_unknown"))).not.toMatchObject({ groupKey: "network" });
    expect(businessInfoOf(op("search_schema"))).toEqual({
      groupKey: "model",
      nameKey: "knowledgeNetwork.contextLoaderPanel.toolNames.search_schema",
      name: "Semantic Search",
    });
  });

  it("orders lifecycle tools from start to finish", () => {
    const tools = [op("bkn_finish_interaction"), op("bkn_start_interaction")];
    expect(tools.sort((left, right) => compareToolsInBusinessGroup("lifecycle", left, right)).map((tool) => tool.id)).toEqual([
      "bkn_start_interaction",
      "bkn_finish_interaction",
    ]);
  });
});
