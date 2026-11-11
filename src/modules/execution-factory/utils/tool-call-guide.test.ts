/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  buildToolCallCli,
  buildToolCallCurl,
  toolCallEnvelope,
  toolCallKind,
  toolCallResponseExample,
  toolCallUrl,
} from "./tool-call-guide";

type ResponseExample = { status_code: number; body: Record<string, unknown> };

const readResponse = (text: string) => JSON.parse(text) as ResponseExample;

/** Reads back what a POSIX shell passes for one single-quoted word. */
function unquote(word: string): string {
  return word.replace(/^'|'$/g, "").replace(/'\\''/g, "'");
}

describe("toolCallKind", () => {
  it("tells the three kinds of tool apart", () => {
    expect(toolCallKind("openapi")).toEqual({ kind: "openapi" });
    expect(toolCallKind("function", { script_type: "python" })).toEqual({ kind: "python" });
    expect(toolCallKind("function")).toEqual({ kind: "python" });
    expect(toolCallKind("function", { script_type: "cypher", result_shape: "table" })).toEqual({
      kind: "cypher",
      shape: "table",
    });
    expect(toolCallKind("function", { script_type: "cypher" })).toEqual({
      kind: "cypher",
      shape: "value",
    });
  });
});

describe("toolCallEnvelope", () => {
  it("puts every function argument in body, with the input's example", () => {
    expect(
      toolCallEnvelope(undefined, {
        inputs: [
          { name: "code", type: "string", required: true, example: "S1" },
          { name: "min", type: "number", required: true },
        ],
      }),
    ).toEqual({ body: { code: "S1", min: expect.any(Number) as unknown } });
  });

  it("splits an API tool's parameters by where the request carries them", () => {
    const envelope = toolCallEnvelope({
      parameters: [
        { name: "id", in: "path", required: true, type: "string" },
        { name: "page", in: "query", type: "integer" },
      ],
    });
    expect(Object.keys(envelope.path ?? {})).toEqual(["id"]);
    expect(Object.keys(envelope.query ?? {})).toEqual(["page"]);
    expect(envelope.header).toBeUndefined();
    expect(envelope.body).toEqual({});
  });
});

describe("buildToolCallCurl", () => {
  it("posts the envelope to the toolbox proxy, with a quote in a value kept intact", () => {
    const envelope = { body: { name: "O'Brien" } };
    const curl = buildToolCallCurl({
      origin: "https://bkn.example",
      boxId: "b 1",
      toolId: "t1",
      envelope,
    });
    expect(curl).toContain(`'${toolCallUrl("https://bkn.example", "b 1", "t1")}'`);
    expect(curl).toContain("/api/agent-operator-integration/v1/tool-box/b%201/proxy/t1");
    expect(curl).toContain('-H "Authorization: Bearer $TOKEN"');
    const data = /-d ('[\s\S]*')$/.exec(curl)?.[1] ?? "";
    expect(JSON.parse(unquote(data))).toEqual(envelope);
  });
});

describe("buildToolCallCli", () => {
  it("opens an interaction, then calls execute_tool with its ids and the body as arguments", () => {
    const cli = buildToolCallCli({ boxId: "b1", toolId: "t1", envelope: { body: { code: "S1" } } });
    const [start, call] = cli.split("\n\n");
    expect(start.startsWith('openbkn context tool-call "$KN_ID" bkn_start_interaction')).toBe(true);
    // bkn_start_interaction refuses kn_id; it takes the question and who asks.
    expect(JSON.parse(unquote(/--args ('.*')$/.exec(start)?.[1] ?? ""))).toEqual({
      question: "…",
      agent_name: "my-agent",
      conversation_mode: "new",
    });
    expect(call.startsWith('openbkn context tool-call "$KN_ID" execute_tool')).toBe(true);
    const args = /--args ('[\s\S]*')$/.exec(call)?.[1] ?? "";
    expect(JSON.parse(unquote(args))).toEqual({
      kn_id: "$KN_ID",
      toolbox_id: "b1",
      tool_id: "t1",
      arguments: { code: "S1" },
      bkn_context: { conversation_id: "$CONVERSATION_ID", interaction_id: "$INTERACTION_ID" },
    });
  });
});

describe("toolCallResponseExample", () => {
  it("shows the body a Cypher function answers for its shape", () => {
    const value = readResponse(toolCallResponseExample({ kind: "cypher", shape: "value" }));
    expect(value).toMatchObject({ status_code: 200, body: { value: 16 } });
    const table = readResponse(toolCallResponseExample({ kind: "cypher", shape: "table" }));
    expect(Object.keys(table.body)).toEqual(["columns", "entries", "limited"]);
  });

  it("puts a Python handler's value under result, as the sandbox answers", () => {
    const python = readResponse(toolCallResponseExample({ kind: "python" }));
    expect(Object.keys(python)).toEqual(["status_code", "headers", "body", "error", "duration_ms"]);
    expect(python.body).toHaveProperty("result");
    expect(python.body).toHaveProperty("exit_code", 0);
  });
});
