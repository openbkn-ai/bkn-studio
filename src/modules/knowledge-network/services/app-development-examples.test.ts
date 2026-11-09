/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  actionCall,
  checkExample,
  cypherCall,
  functionCall,
  queryObjectsCall,
  pythonProjectCommands,
  pythonRun,
  sdkVersionOf,
  searchCall,
  typeScriptInstallCommand,
} from "@/modules/knowledge-network/services/app-development-examples";
import type { McpToolDef } from "@/modules/knowledge-network/services/context-loader.service";

const KN = "supply";

const productRow = {
  _instance_identity: { material_number: "367-000061" },
  _display: "367-000061",
  material_number: "367-000061",
  material_name: "农业无人飞机",
};

const bomRow = {
  _instance_identity: { bom_material_code: "526-000006", seq_no: 1, bom_version: "2026-08-04" },
  bom_material_code: "526-000006",
};

// Field order as the backend returned it: key and name are not first.
const materialRow = {
  _instance_identity: { material_code: "526-000006" },
  product_fixedleadtime: 1,
  modelnum: "YN812",
  material_name: "北斗导航农机驾驶仪",
  material_code: "526-000006",
};

function tool(name: string, properties: string[], required: string[], strict = false): McpToolDef {
  return {
    name,
    inputSchema: {
      type: "object",
      properties: Object.fromEntries(properties.map((p) => [p, { type: "string" }])),
      required,
      ...(strict ? { additionalProperties: false } : {}),
    },
  };
}

describe("tool inputs", () => {
  it("filters objects by the first business field of the sample row", () => {
    const { call, filtered } = queryObjectsCall(KN, "product", productRow);
    expect(filtered).toBe(true);
    expect(call.query).toEqual({ kn_id: KN, ot_id: "product" });
    expect(call.body).toEqual({
      filters: [{ field: "material_number", op: "==", value: "367-000061" }],
      limit: 10,
    });
    // Regression: the tool-debug body carried need_total, which the Python SDK rejects.
    expect(call.body).not.toHaveProperty("need_total");
  });

  it("queries without a filter when there is no sample row", () => {
    const { call, filtered } = queryObjectsCall(KN, "product", null);
    expect(filtered).toBe(false);
    expect(call.body).toEqual({ limit: 10 });
  });

  it("binds $id for a single-field key and returns target properties, not the node", () => {
    const { call } = cypherCall(
      KN,
      { id: "prod2bom", sourceId: "product", targetId: "material" },
      productRow,
      materialRow,
    );
    expect(call.body.query).toBe(
      "MATCH (s:`product` {`material_number`: $id})-[:`prod2bom`]->(t:`material`) " +
        "RETURN t.`material_code`, t.`material_name`, t.`product_fixedleadtime` LIMIT 10",
    );
    expect(call.body.parameters).toEqual({ id: "367-000061" });
  });

  it("binds one parameter per field of a composite key", () => {
    const { call } = cypherCall(
      KN,
      { id: "bom2mat", sourceId: "bom", targetId: "material" },
      bomRow,
      materialRow,
    );
    expect(call.body.query).toContain(
      "{`bom_material_code`: $bom_material_code, `seq_no`: $seq_no, `bom_version`: $bom_version}",
    );
    expect(call.body.parameters).toEqual({
      bom_material_code: "526-000006",
      seq_no: 1,
      bom_version: "2026-08-04",
    });
  });

  it("names parameters that are valid Cypher identifiers", () => {
    const { call } = cypherCall(
      KN,
      { id: "r", sourceId: "a", targetId: "b" },
      { _instance_identity: { "1st-key": "x", "1st_key": "y" } },
      null,
    );
    expect(call.body.parameters).toEqual({ p_1st_key: "x", p_1st_key_: "y" });
    expect(call.body.query).toContain("RETURN t LIMIT 10");
  });

  it("always names the action's target instances", () => {
    const withRow = actionCall(KN, "close", [{ name: "approval_token", type: "string" }], bomRow);
    expect(withRow.body._instance_identities).toEqual([bomRow._instance_identity]);
    expect(withRow.body.dynamic_params).toEqual({ approval_token: "<approval_token>" });

    const withoutRow = actionCall(KN, "close", [], null);
    expect(withoutRow.body._instance_identities).toEqual([{ "<primary key>": "<value>" }]);
    expect(withoutRow.body).not.toHaveProperty("dynamic_params");
  });

  it("names no target for an action that creates objects", () => {
    const call = actionCall(KN, "create", [{ name: "task_name" }], bomRow, {
      createsObjects: true,
    });
    expect(call.body).not.toHaveProperty("_instance_identities");
    expect(call.body.dynamic_params).toEqual({ task_name: "<task_name>" });
  });

  it("fills a function's required arguments with typed placeholders", () => {
    const call = functionCall(KN, "box-1", "tool-1", {
      request_body: {
        content: {
          "application/json": {
            schema: {
              properties: { product: { type: "string" }, depth: { type: "number" } },
              required: ["product"],
            },
          },
        },
      },
    });
    expect(call.body).toEqual({
      kn_id: KN,
      toolbox_id: "box-1",
      tool_id: "tool-1",
      arguments: { product: "<product>" },
    });
  });
});

describe("install", () => {
  it("pins the TypeScript SDK to the platform's major.minor.patch", () => {
    expect(sdkVersionOf("0.2.1-main.20261029210927.sha9156ec5")).toEqual({
      version: "0.2.1",
      prerelease: true,
    });
    expect(sdkVersionOf("0.2.0")).toEqual({ version: "0.2.0", prerelease: false });
    expect(sdkVersionOf("dev")).toBeNull();
    expect(typeScriptInstallCommand(sdkVersionOf("0.2.0"))).toBe(
      "npm install @openbkn/bkn-sdk@0.2.0",
    );
    // A development build takes that version's rc now and its release later, never the next one.
    expect(typeScriptInstallCommand(sdkVersionOf("0.2.1-main.20261029210927.sha9156ec5"))).toBe(
      'npm install "@openbkn/bkn-sdk@>=0.2.1-0 <0.2.2-0"',
    );
    expect(typeScriptInstallCommand(null)).toBe("npm install @openbkn/bkn-sdk");
  });
});

describe("checkExample", () => {
  const tools = [
    tool(
      "query_object_instance",
      ["kn_id", "ot_id", "filters", "limit", "bkn_context"],
      ["kn_id", "ot_id", "bkn_context"],
    ),
    tool(
      "query_metric",
      ["kn_id", "metric_id", "version", "bkn_context"],
      ["kn_id", "metric_id", "version", "bkn_context"],
      true,
    ),
  ];

  it("does not count bkn_context as missing and merges query parameters into the input", () => {
    expect(checkExample(queryObjectsCall(KN, "product", productRow).call, tools)).toEqual({
      status: "ok",
    });
  });

  it("flags undeclared fields even where the schema does not forbid them", () => {
    const call = queryObjectsCall(KN, "product", productRow).call;
    const check = checkExample({ ...call, body: { ...call.body, need_total: true } }, tools);
    expect(check).toEqual({
      status: "mismatch",
      missing: [],
      undeclared: ["need_total"],
      unknownTool: false,
    });
  });

  it("rejects the metric body the tool debugger used to build", () => {
    const stale = {
      tool: "query_metric",
      knId: KN,
      query: {},
      body: { kn_id: KN, metric_id: "m", time: { instant: true } },
    };
    expect(checkExample(stale, tools)).toEqual({
      status: "mismatch",
      missing: ["version"],
      undeclared: ["time"],
      unknownTool: false,
    });
  });

  it("reports a tool the platform does not publish, and skips the check without definitions", () => {
    expect(checkExample(searchCall(KN, "x"), tools)).toMatchObject({ unknownTool: true });
    expect(checkExample(searchCall(KN, "x"), null)).toEqual({ status: "unchecked" });
  });
});

describe("Python projects", () => {
  const comments = { python: "py", activate: "act", uv: "uv" };

  it("makes a venv with pip, warning that python3 may be too old", () => {
    expect(pythonProjectCommands("venv", "my-app", ["x", "y"], comments)).toBe(
      "mkdir my-app && cd my-app\npython3 -m venv .venv  # py\nsource .venv/bin/activate  # act\npip install x y",
    );
    expect(pythonRun("venv", "python main.py")).toBe("python main.py");
  });

  it("asks uv for a flat app, so main.py sits next to the generated package", () => {
    expect(pythonProjectCommands("uv", "my-app", ["x"], comments)).toBe(
      "uv init --app --no-package my-app && cd my-app  # uv\nuv add x",
    );
    expect(pythonRun("uv", "bkn-osdk generate k --out ./bkn")).toBe(
      "uv run bkn-osdk generate k --out ./bkn",
    );
  });
});
