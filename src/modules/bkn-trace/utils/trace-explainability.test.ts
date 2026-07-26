/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { businessRows, claimRows, evidenceRows } from "@/modules/bkn-trace/utils/trace-explainability";

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
        node_type: "object",
        label: "Customer",
        version_status: "versioned",
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
});
