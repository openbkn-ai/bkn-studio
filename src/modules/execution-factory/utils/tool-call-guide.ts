/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  CypherResultShape,
  FunctionInputPayload,
} from "@/modules/execution-factory/types/function-input";
import type { ToolIoSpec, ToolMetadataType } from "@/modules/execution-factory/types/tool";
import { buildSampleEvent } from "@/modules/execution-factory/utils/function-sample-event";
import {
  buildHttpDebugInitialValues,
  parseJsonObject,
} from "@/modules/execution-factory/utils/http-debug-request";

/** What a call returns in the envelope's `body`, which differs by the kind of tool. */
export type ToolCallKind =
  { kind: "openapi" } | { kind: "python" } | { kind: "cypher"; shape: CypherResultShape };

export function toolCallKind(
  metadataType: ToolMetadataType,
  functionInput?: Pick<FunctionInputPayload, "script_type" | "result_shape">,
): ToolCallKind {
  if (metadataType !== "function") return { kind: "openapi" };
  if (functionInput?.script_type === "cypher") {
    return { kind: "cypher", shape: functionInput.result_shape ?? "value" };
  }
  return { kind: "python" };
}

/** Placeholders the reader replaces; written so a shell leaves them for the reader to fill. */
export const TOOL_CALL_TOKEN_PLACEHOLDER = "$TOKEN";
export const TOOL_CALL_KN_PLACEHOLDER = "$KN_ID";
export const TOOL_CALL_CONVERSATION_PLACEHOLDER = "$CONVERSATION_ID";
export const TOOL_CALL_INTERACTION_PLACEHOLDER = "$INTERACTION_ID";

export type ToolCallEnvelope = {
  header?: Record<string, unknown>;
  query?: Record<string, unknown>;
  path?: Record<string, unknown>;
  body?: Record<string, unknown>;
};

/**
 * The proxy request body for one call. A function's arguments all go in `body`, each with the
 * example it was tried with or a value of its type, as the workbench's test input starts. An API
 * tool's parameters are split by where the HTTP request carries them, with the debug panel's
 * samples. Empty places are left out.
 */
export function toolCallEnvelope(
  ioSpec?: ToolIoSpec,
  functionInput?: FunctionInputPayload,
): ToolCallEnvelope {
  const read = (text: string) => {
    try {
      const value = parseJsonObject(text, "");
      return value && Object.keys(value).length > 0 ? value : undefined;
    } catch {
      return undefined;
    }
  };
  if (functionInput) {
    return { body: read(buildSampleEvent(functionInput.inputs)) ?? {} };
  }
  const values = buildHttpDebugInitialValues(ioSpec);
  const envelope: ToolCallEnvelope = {};
  const header = read(values.requestHeaders);
  const query = read(values.requestQuery);
  const path = read(values.requestPath);
  if (header) envelope.header = header;
  if (query) envelope.query = query;
  if (path) envelope.path = path;
  envelope.body = read(values.requestBody) ?? {};
  return envelope;
}

export function toolCallUrl(origin: string, boxId: string, toolId: string): string {
  return `${origin}/api/agent-operator-integration/v1/tool-box/${encodeURIComponent(
    boxId,
  )}/proxy/${encodeURIComponent(toolId)}`;
}

/** A JSON value inside single quotes for a POSIX shell: each `'` closes, escapes and reopens. */
function shellQuote(text: string): string {
  return `'${text.replace(/'/g, `'\\''`)}'`;
}

export function buildToolCallCurl(params: {
  origin: string;
  boxId: string;
  toolId: string;
  envelope: ToolCallEnvelope;
}): string {
  return [
    `curl -X POST ${shellQuote(toolCallUrl(params.origin, params.boxId, params.toolId))} \\`,
    `  -H "Authorization: Bearer ${TOOL_CALL_TOKEN_PLACEHOLDER}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d ${shellQuote(JSON.stringify(params.envelope, null, 2))}`,
  ].join("\n");
}

/**
 * The same call made by an Agent through Context Loader, once the tool is mounted on a network.
 * Context Loader runs a tool only inside a managed interaction: the first command opens one, and
 * the second passes its ids as bkn_context. Without them the call is refused as
 * conversation_required.
 */
export function buildToolCallCli(params: {
  boxId: string;
  toolId: string;
  envelope: ToolCallEnvelope;
}): string {
  const start = { question: "…", agent_name: "my-agent", conversation_mode: "new" };
  const call = {
    kn_id: TOOL_CALL_KN_PLACEHOLDER,
    toolbox_id: params.boxId,
    tool_id: params.toolId,
    arguments: params.envelope.body ?? {},
    bkn_context: {
      conversation_id: TOOL_CALL_CONVERSATION_PLACEHOLDER,
      interaction_id: TOOL_CALL_INTERACTION_PLACEHOLDER,
    },
  };
  return [
    `openbkn context tool-call "${TOOL_CALL_KN_PLACEHOLDER}" bkn_start_interaction \\`,
    `  --args ${shellQuote(JSON.stringify(start))}`,
    "",
    `openbkn context tool-call "${TOOL_CALL_KN_PLACEHOLDER}" execute_tool \\`,
    `  --args ${shellQuote(JSON.stringify(call, null, 2))}`,
  ].join("\n");
}

/** What the platform answers: the HTTP status is 200 whenever the tool ran, so read status_code. */
export function toolCallResponseExample(kind: ToolCallKind): string {
  const body = (() => {
    if (kind.kind === "cypher") {
      return kind.shape === "value"
        ? { value: 16 }
        : {
            columns: [
              { name: "s.name", type: "string" },
              { name: "total", type: "integer" },
            ],
            entries: [{ "s.name": "…", total: 16 }],
            limited: false,
          };
    }
    // A Python function answers with the sandbox's run; the handler's value is its result.
    return kind.kind === "python"
      ? { exit_code: 0, stdout: "", stderr: "", result: { "…": "…" } }
      : { "…": "…" };
  })();
  return JSON.stringify(
    { status_code: 200, headers: {}, body, error: "", duration_ms: 42 },
    null,
    2,
  );
}
