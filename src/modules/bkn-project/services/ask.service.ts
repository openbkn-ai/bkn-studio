/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { getRuntimeConfig } from "@/framework/runtime/config";
import { objectTypeBody, relationBody } from "@/modules/bkn-project/services/draft.service";
import type {
  AskAnswer,
  AskDropped,
  AskEnds,
  AskRevision,
  AskTurn,
  DraftObjectTypeSave,
  DraftRelationTypeSave,
} from "@/modules/bkn-project/types/draft";
import { makeAuthedFetch } from "@/modules/knowledge-network/services/agent-chat.service";

const API_PREFIX = "/bkn-project/v1/projects";
const useMock = import.meta.env.VITE_USE_MOCK !== "false";

/** Ask AI answers within 45 seconds; the page waits a little longer than that. */
export const ASK_TIMEOUT_MS = 60_000;
/** Ask AI takes at most this many characters, as bkn-project does. */
export const ASK_MAX_LENGTH = 500;
/** How many questions before this one are sent back with it, as bkn-project keeps. */
export const ASK_HISTORY_TURNS = 4;

/** Why Ask AI did not answer: bkn-project's error code without its prefix, or `other`. */
export class AskError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "AskError";
  }
}

export type AskRequest = {
  history: AskTurn[];
  itemId: string;
  /** The answer's text as it is written. */
  onText: (text: string) => void;
  projectId: string;
  question: string;
  signal?: AbortSignal;
} & (
  | { kind: "object_types"; working?: DraftObjectTypeSave }
  | { kind: "relation_types"; working?: DraftRelationTypeSave }
);

type BackendPair = { source_property?: { name?: string }; target_property?: { name?: string } };
type BackendEnds = {
  mapping_rules?:
    | BackendPair[]
    | {
        backing_data_source?: { id?: string };
        source_mapping_rules?: BackendPair[];
        target_mapping_rules?: BackendPair[];
      };
  source_object_type_id?: string;
  target_object_type_id?: string;
  type?: string;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const text = (value: unknown) => (typeof value === "string" ? value : "");

const pairs = (rules: BackendPair[] | undefined) =>
  (rules ?? []).map((pair) => ({
    sourceProperty: pair.source_property?.name ?? "",
    targetProperty: pair.target_property?.name ?? "",
  }));

function mapEnds(value: BackendEnds & Record<string, unknown>): AskEnds {
  const rules = value.mapping_rules;
  const ends = {
    source: value.source_object_type_id ?? "",
    target: value.target_object_type_id ?? "",
  };
  if (value.type === "indirect" && rules && !Array.isArray(rules)) {
    return {
      ...ends,
      link: {
        resourceId: rules.backing_data_source?.id ?? "",
        sourceMapping: pairs(rules.source_mapping_rules),
        targetMapping: pairs(rules.target_mapping_rules),
      },
      mapping: [],
    };
  }
  return { ...ends, mapping: pairs(Array.isArray(rules) ? rules : []) };
}

/** A revision as the page adopts it; one of a shape the page does not know is left out. */
function mapRevision(value: unknown): AskRevision | null {
  const item = asRecord(value);
  if (!item) {
    return null;
  }
  const reason = text(item.reason);
  switch (item.field) {
    case "name":
    case "comment":
    case "display_key":
      return typeof item.value === "string"
        ? { field: item.field, reason, value: item.value }
        : null;
    case "primary_keys":
      return Array.isArray(item.value)
        ? { field: "primary_keys", reason, value: item.value.map(String) }
        : null;
    case "property": {
      const property = asRecord(item.value);
      return property && typeof property.name === "string"
        ? {
            field: "property",
            reason,
            value: {
              ...(typeof property.comment === "string" ? { comment: property.comment } : {}),
              ...(typeof property.display_name === "string"
                ? { displayName: property.display_name }
                : {}),
              name: property.name,
            },
          }
        : null;
    }
    case "ends": {
      const ends = asRecord(item.value);
      return ends ? { field: "ends", reason, value: mapEnds(ends) } : null;
    }
    default:
      return null;
  }
}

export function mapAnswer(value: unknown): AskAnswer {
  const data = asRecord(value) ?? {};
  return {
    answer: text(data.answer),
    dropped: (Array.isArray(data.dropped) ? data.dropped : [])
      .map(asRecord)
      .filter((item): item is Record<string, unknown> => item !== null)
      .map((item): AskDropped => ({ field: text(item.field), reason: text(item.reason) })),
    revisions: (Array.isArray(data.revisions) ? data.revisions : [])
      .map(mapRevision)
      .filter((item): item is AskRevision => item !== null),
  };
}

/** bkn-project's error code, `BknProject.Draft.AskTimeout`, as the page names it: `AskTimeout`. */
const codeOf = (value: unknown) => {
  const data = asRecord(value);
  const code = text(data?.error_code) || text(data?.code);
  return code.slice(code.lastIndexOf(".") + 1) || "other";
};

function parseFrame(frame: string): { data: unknown; name: string } | null {
  let name = "message";
  const lines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) {
      name = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      lines.push(line.slice(5).replace(/^ /, ""));
    }
  }
  if (!lines.length) {
    return null;
  }
  try {
    return { data: JSON.parse(lines.join("\n")) as unknown, name };
  } catch {
    return null;
  }
}

/* ----------------------------- Mock (local development) ----------------------------- */

const MOCK_STEP_MS = 60;

async function askMock(request: AskRequest): Promise<AskAnswer> {
  const answer =
    request.kind === "object_types"
      ? "This object type stands for one record per row of its table. Its description could say what a record is, and its title could be a property people recognize."
      : "This relation joins its two ends by matching properties. Its description could say what the link means for the business.";
  for (const word of answer.split(/(?<= )/)) {
    if (request.signal?.aborted) {
      throw new AskError("aborted");
    }
    await new Promise((resolve) => window.setTimeout(resolve, MOCK_STEP_MS));
    request.onText(word);
  }
  const revisions: AskRevision[] = [
    {
      field: "comment",
      reason: "The description is empty or vague.",
      value: "One record per row.",
    },
  ];
  if (request.kind === "object_types" && request.working?.properties.length) {
    const first = request.working.properties[0];
    revisions.push({
      field: "property",
      reason: "A clearer display name helps people find it.",
      value: { displayName: `${first.displayName || first.name} (main)`, name: first.name },
    });
    revisions.push({
      field: "display_key",
      reason: "People know records by it.",
      value: first.name,
    });
  }
  return { answer, dropped: [{ field: "display_key", reason: "unknown_property" }], revisions };
}

/**
 * Asks AI about an object or relation type of a ready draft, with what is being edited and the
 * questions before it. The answer's text comes as it is written; its revisions, checked by
 * bkn-project, come at the end. Nothing of the draft is changed.
 */
export async function askDraftItem(request: AskRequest): Promise<AskAnswer> {
  if (useMock) {
    return askMock(request);
  }
  const timeout = new AbortController();
  const timer = window.setTimeout(() => timeout.abort(), ASK_TIMEOUT_MS);
  const abort = () => timeout.abort();
  request.signal?.addEventListener("abort", abort, { once: true });
  const { apiBaseUrl, auth } = getRuntimeConfig();
  const fetchFn = makeAuthedFetch({
    getToken: () => auth.tokenManager.getAccessToken() ?? "",
    refresh: () => auth.tokenManager.refreshAccessToken(),
  });
  try {
    const working = request.working
      ? request.kind === "object_types"
        ? objectTypeBody(request.working)
        : relationBody(request.working)
      : undefined;
    const response = await fetchFn(
      `${apiBaseUrl}${API_PREFIX}/${encodeURIComponent(request.projectId)}/ontology/draft/${request.kind}/${encodeURIComponent(request.itemId)}/ask`,
      {
        body: JSON.stringify({
          history: request.history.slice(-ASK_HISTORY_TURNS),
          question: request.question,
          ...(working ? { working } : {}),
        }),
        headers: { Accept: "text/event-stream", "Content-Type": "application/json" },
        method: "POST",
        signal: timeout.signal,
      },
    );
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      throw new AskError(codeOf(body));
    }
    if (!response.body) {
      throw new AskError("other");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let written = "";
    for (;;) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
      const frames = buffer.split("\n\n");
      buffer = done ? "" : (frames.pop() ?? "");
      for (const frame of frames) {
        const parsed = parseFrame(frame);
        if (!parsed) {
          continue;
        }
        const data = asRecord(parsed.data);
        if (parsed.name === "token" && typeof data?.content === "string") {
          written += data.content;
          request.onText(data.content);
        } else if (parsed.name === "result") {
          const answer = mapAnswer(data);
          return { ...answer, answer: answer.answer || written };
        } else if (parsed.name === "error") {
          throw new AskError(codeOf(data));
        }
      }
      if (done) {
        // The answer ended before its revisions came.
        throw new AskError("other");
      }
    }
  } catch (error) {
    if (error instanceof AskError) {
      throw error;
    }
    throw new AskError(
      timeout.signal.aborted && !request.signal?.aborted
        ? "AskTimeout"
        : request.signal?.aborted
          ? "aborted"
          : "other",
    );
  } finally {
    window.clearTimeout(timer);
    request.signal?.removeEventListener("abort", abort);
  }
}
