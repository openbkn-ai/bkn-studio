/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { CONTEXT_LOADER_OPS, mcpOpsFrom } from "./context-loader.service";

const tool = (name: string) => ({
  name,
  description: name,
  inputSchema: { type: "object" as const, properties: {} },
});

describe("mcpOpsFrom", () => {
  // The panel labels this list "loaded N services". Answering with a compiled-in constant made a
  // stale build indistinguishable from a real surface: it advertised find_skills after that tool
  // was retired, and hid every tool added since the constant was last edited.
  it("has no list until tools/list answers", () => {
    expect(mcpOpsFrom(null)).toEqual([]);
  });

  it("lists exactly what the deployment reports", () => {
    const ops = mcpOpsFrom([tool("search_capabilities"), tool("some_tool_only_this_deploy_has")]);
    expect(ops.map((op) => op.id)).toEqual([
      "search_capabilities",
      "some_tool_only_this_deploy_has",
    ]);
  });

  it("does not add a local op the deployment did not report", () => {
    const ops = mcpOpsFrom([tool("run_sql")]);
    expect(ops).toHaveLength(1);
    expect(ops.some((op) => op.id === "query_object_instance")).toBe(false);
  });

  it("uses the curated op for a reported tool and synthesizes the rest", () => {
    const curated = CONTEXT_LOADER_OPS.find((op) => op.id === "run_sql");
    expect(curated).toBeDefined();
    const ops = mcpOpsFrom([tool("run_sql"), tool("not_in_catalog")]);
    expect(ops[0].id).toBe(curated?.id);
    expect(ops[1].id).toBe("not_in_catalog");
  });

  // /mcp-compact/ rejects undeclared arguments, so a curated example carrying REST-only fields
  // would fail there unedited.
  it("narrows a curated example to the arguments the reported tool declares", () => {
    const [op] = mcpOpsFrom([
      {
        name: "search_schema",
        inputSchema: { type: "object", properties: { query: {}, kn_id: {} } },
      },
    ]);
    expect(op.mcpArgs).toEqual({
      query: "Find core business objects and relations",
      kn_id: "your_kn_id",
    });
  });

  it("keeps the curated example when the tool declares every example argument", () => {
    const curated = CONTEXT_LOADER_OPS.find((op) => op.id === "get_kn_detail")!;
    const [op] = mcpOpsFrom([
      { name: "get_kn_detail", inputSchema: { type: "object", properties: { kn_id: {} } } },
    ]);
    expect(op.id).toBe(curated.id);
    expect(op.mcpArgs).toEqual(curated.mcpArgs);
    expect(op.body).toEqual(curated.body);
  });

  it.each([
    "bkn_start_interaction",
    "bkn_finish_interaction",
    "execute_action",
    "execute_tool",
    "execute_skill",
    "run_code",
    "run_shell",
  ])("does not offer a format for undeclared %s arguments", (name) => {
    const [op] = mcpOpsFrom([
      { name, inputSchema: { type: "object", properties: { question: { type: "string" } } } },
    ]);
    expect(op.query.some((param) => param.name === "response_format")).toBe(false);
  });

  it("uses the declared format enum and default for curated and synthesized tools", () => {
    for (const name of ["search_capabilities", "new_tool"]) {
      const [op] = mcpOpsFrom([
        {
          name,
          inputSchema: {
            type: "object",
            properties: {
              response_format: { type: "string", enum: ["toon", "json"], default: "toon" },
            },
          },
        },
      ]);
      expect(op.query.find((param) => param.name === "response_format")).toEqual({
        name: "response_format",
        options: ["toon", "json"],
        value: "toon",
      });
    }
  });

  it("keeps synthesized format choices out of the editable example body", () => {
    const [op] = mcpOpsFrom([
      {
        name: "new_tool",
        inputSchema: {
          type: "object",
          properties: {
            response_format: { type: "string", enum: ["toon", "json"] },
          },
        },
      },
    ]);
    expect(op.query.find((param) => param.name === "response_format")?.value).toBe("json");
    expect(op.mcpArgs).not.toHaveProperty("response_format");
    expect(op.body).not.toHaveProperty("response_format");
  });

  // The retired tool must not come back through the curated catalogue (#1401).
  it("carries no entry for the retired recall tools", () => {
    expect(
      CONTEXT_LOADER_OPS.some((op) => op.id === "find_skills" || op.id === "search_tools"),
    ).toBe(false);
    expect(CONTEXT_LOADER_OPS.some((op) => op.id === "search_capabilities")).toBe(true);
  });
});
