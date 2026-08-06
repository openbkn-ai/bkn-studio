/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  businessEvidenceGroups,
  businessRows,
  businessNodePresentation,
  businessStoryStages,
  claimRows,
  evidenceRows,
  explainabilityPartialReasons,
} from "@/modules/bkn-trace/utils/trace-explainability";

describe("trace explainability rows", () => {
  it("formats model call claims without raw prompt or output", () => {
    const rows = claimRows([
      {
        claim_id: "claim_1",
        claim_type: "finding",
        visibility: "visible",
        version_status: "unversioned",
        subject_refs: {
          model_name: "gpt-demo",
          operation: "model.chat.completions",
          output_hash: "sha256:result",
          prompt_hash: "sha256:prompt",
          status: "success",
        },
      },
    ]);

    expect(rows[0]).toMatchObject({
      id: "claim_1",
      kind: "finding",
      primary: "gpt-demo",
      status: "success",
    });
    expect(JSON.stringify(rows)).not.toContain("prompt_hash");
    expect(JSON.stringify(rows)).not.toContain("output_hash");
  });

  it("formats evidence refs from model and data producers", () => {
    const rows = evidenceRows([
      {
        ref_id: "source:model:model_demo",
        ref_type: "source_ref",
        source_system: "mf-model-api",
        summary: { kind: "model", model_name: "gpt-demo", model_provider: "openai" },
        summary_hash: "sha256:model_hash",
        validity: "observed",
        version_status: "unversioned",
        visibility: "visible",
      },
      {
        ref_id: "resource_row:res_customer:row_1",
        ref_type: "row_ref",
        source_system: "vega-data",
        summary: { kind: "resource_row", resource_id: "res_customer", row_hash: "sha256:very_long_hash_value_for_display" },
        summary_hash: "sha256:row_hash",
        validity: "observed",
        version_status: "unversioned",
        visibility: "visible",
      },
    ]);

    expect(rows[0].primary).toBe("gpt-demo");
    expect(rows[0].secondary).toContain("mf-model-api");
    expect(rows[1].primary).toBe("res_customer");
    expect(rows[1].kind).toBe("resource_row");
  });

  it("formats business graph nodes with visibility and version status", () => {
    const rows = businessRows([
      {
        id: "business_ref:object:customer",
        nodeType: "object",
        label: "Customer",
        versionStatus: "versioned",
        visibility: "visible",
        properties: { source_system: "bkn-backend", validity: "resolved" },
      },
    ]);

    expect(rows[0]).toMatchObject({
      kind: "object",
      primary: "Customer",
      status: "resolved",
      versionStatus: "versioned",
      visibility: "visible",
    });
  });

  it("groups the business story into the five user-facing stages", () => {
    const stages = businessStoryStages([
      { id: "interaction:1", nodeType: "interaction", stage: "intent", properties: {} },
      { id: "event:1", nodeType: "operation", stage: "execution", properties: {} },
      { id: "evidence:1", nodeType: "evidence_ref", stage: "evidence", properties: {} },
      { id: "claim:1", nodeType: "claim", stage: "claim", properties: {} },
      { id: "action:1", nodeType: "action", stage: "action", properties: {} },
    ]);

    expect(stages.map((stage) => stage.stage)).toEqual([
      "intent",
      "execution",
      "evidence",
      "claim",
      "action",
    ]);
    expect(stages.map((stage) => stage.nodes.length)).toEqual([1, 1, 1, 1, 1]);
  });

  it("treats a resolved business object without an explicit stage as business evidence", () => {
    const stages = businessStoryStages([
      { id: "business:object:kn:forecast", nodeType: "object", properties: {} },
    ]);

    expect(stages.find((stage) => stage.stage === "evidence")?.nodes).toHaveLength(1);
  });

  it("groups resolved business references as data, logic, or action evidence", () => {
    const groups = businessEvidenceGroups([
      {
        id: "business:object:supplychain:bom",
        nodeType: "business_ref",
        display: { name: "产品BOM" },
        properties: { ref_type: "object_type" },
        stage: "evidence",
        visibility: "visible",
      },
      {
        id: "business:metric:supplychain:available_qty",
        nodeType: "business_ref",
        display: { name: "生产可用库存" },
        properties: { ref_type: "metric" },
        stage: "evidence",
        visibility: "visible",
      },
      {
        id: "business:action:supplychain:create_po",
        nodeType: "business_ref",
        display: { name: "创建采购申请" },
        properties: { ref_type: "action_type" },
        stage: "action",
        visibility: "visible",
      },
      {
        id: "operation:run-sql",
        nodeType: "operation",
        properties: { operation_name: "run_sql" },
        stage: "execution",
      },
    ]);

    expect(groups.data.map((node) => node.display?.name)).toEqual(["产品BOM"]);
    expect(groups.logic.map((node) => node.display?.name)).toEqual(["生产可用库存"]);
    expect(groups.action.map((node) => node.display?.name)).toEqual(["创建采购申请"]);
  });

  it("keeps visible unknown evidence as data while omitting suppressed references", () => {
    const groups = businessEvidenceGroups([
      {
        id: "business:source:supplychain:inventory-feed",
        nodeType: "business_ref",
        display: { name: "库存同步来源" },
        properties: { ref_type: "source_ref" },
        stage: "evidence",
        visibility: "visible",
      },
      {
        id: "business:source:supplychain:omitted-feed",
        nodeType: "business_ref",
        display: { name: "不应显示的数据来源" },
        properties: { ref_type: "source_ref" },
        stage: "evidence",
        visibility: "omitted",
      },
    ]);

    expect(groups.data.map((node) => node.display?.name)).toEqual(["库存同步来源"]);
  });

  it("uses backend display names before falling back to technical refs", () => {
    expect(businessNodePresentation({
      id: "evidence:evidence:kn:supplychain_hd0202",
      nodeType: "evidence_ref",
      label: "evidence:kn:supplychain_hd0202",
      display: {
        name: "HD供应链业务知识网络_v3",
      },
      properties: {
        ref_id: "evidence:kn:supplychain_hd0202",
        ref_type: "knowledge_network",
        source_system: "bkn",
      },
    })).toMatchObject({
      title: "HD供应链业务知识网络_v3",
      subtitle: "业务知识网络",
      technicalId: "evidence:kn:supplychain_hd0202",
    });
  });

  it("does not expose an unknown ref type as a business label", () => {
    expect(businessNodePresentation({
      id: "business:source:supplychain:inventory-feed",
      nodeType: "evidence_ref",
      display: { name: "库存同步来源" },
      properties: { ref_type: "source_ref" },
    })).toMatchObject({
      subtitle: "业务证据",
      title: "库存同步来源",
    });
  });

  it("uses the concrete OpenBKN operation before a generic event type", () => {
    expect(businessNodePresentation({
      id: "operation:run-sql",
      nodeType: "operation",
      label: "retrieval.completed",
      properties: {
        event_type: "retrieval.completed",
        operation_name: "run_sql",
      },
    })).toMatchObject({
      title: "查询业务数据",
      subtitle: "run_sql",
      technicalId: "operation:run-sql",
    });
  });

  it("presents namespaced Context Loader operations in business language", () => {
    expect(businessNodePresentation({
      id: "operation:context-run-sql",
      nodeType: "operation",
      label: "retrieval.completed",
      properties: {
        event_type: "retrieval.completed",
        operation_name: "context.run_sql",
      },
    })).toMatchObject({
      title: "查询业务数据",
      subtitle: "context.run_sql",
    });

    expect(businessNodePresentation({
      id: "operation:context-search-schema",
      nodeType: "operation",
      label: "retrieval.completed",
      properties: {
        event_type: "retrieval.completed",
        operation_name: "context.search_schema",
      },
    })).toMatchObject({
      title: "检索知识网络结构",
      subtitle: "context.search_schema",
    });
  });

  it("falls back to true business refs when backend display names are absent", () => {
    expect(businessNodePresentation({
      id: "evidence:evidence:kn:supplychain_hd0202",
      nodeType: "evidence_ref",
      label: "evidence:kn:supplychain_hd0202",
      properties: {
        ref_id: "evidence:kn:supplychain_hd0202",
        ref_type: "knowledge_network",
        source_system: "bkn",
      },
    })).toMatchObject({
      title: "BKN：supplychain_hd0202",
      subtitle: "业务知识网络 · BKN",
      technicalId: "evidence:kn:supplychain_hd0202",
    });

    expect(businessNodePresentation({
      id: "business:property:supplychain_hd0202:supplychain_hd0202_forecast:startdate",
      nodeType: "property",
      properties: {
        ref_id: "property:supplychain_hd0202:supplychain_hd0202_forecast:startdate",
        ref_type: "property",
      },
    })).toMatchObject({
      title: "业务属性：startdate",
      subtitle: "supplychain_hd0202_forecast · 属性",
      technicalId: "property:supplychain_hd0202:supplychain_hd0202_forecast:startdate",
    });
  });

  it("removes stale producer business-ref warnings after the core resolver succeeds", () => {
    expect(explainabilityPartialReasons(
      [["orphan_span"], ["business_ref_unresolved"], ["claim_content_unavailable"]],
      {
        partialReason: ["claim_content_unavailable"],
        visibilitySummary: { authorizedRefCount: 1, unresolvedRefCount: 0 },
      },
    )).toEqual(["orphan_span", "claim_content_unavailable"]);
  });
});
