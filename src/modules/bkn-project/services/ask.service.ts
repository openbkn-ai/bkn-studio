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

const API_PREFIX = "/bkn-project/v1/projects";
const useMock = import.meta.env.VITE_USE_MOCK !== "false";

/** How many questions before this one go with it. */
export const ASK_HISTORY_TURNS = 4;

/** Why Ask AI did not answer: bkn-project's error code without its prefix, or `other`. */
export class AskError extends Error {
  /** What was written before it stopped, as bkn-project kept it. */
  constructor(
    readonly code: string,
    readonly answer = "",
  ) {
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

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const text = (value: unknown) => (typeof value === "string" ? value : "");

/** A relation's ends as bkn-project proposes them: its two ends, joined directly. */
function mapEnds(value: Record<string, unknown>): AskEnds {
  return {
    mapping: (Array.isArray(value.mapping_rules) ? (value.mapping_rules as BackendPair[]) : []).map(
      (pair) => ({
        sourceProperty: pair.source_property?.name ?? "",
        targetProperty: pair.target_property?.name ?? "",
      }),
    ),
    source: text(value.source_object_type_id),
    target: text(value.target_object_type_id),
  };
}

/** A revision as the page applies it; one of a shape the page does not know is left out. */
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
    case "data_property": {
      const property = asRecord(item.value);
      return property && typeof property.name === "string"
        ? {
            field: "data_property",
            reason,
            value: {
              comment: text(property.comment),
              displayName: text(property.display_name),
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

/** bkn-project's answer with the changes it proposes and those it left out. */
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
  const code = text(asRecord(value)?.error_code);
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
      field: "data_property",
      reason: "A clearer display name helps people find it.",
      value: {
        comment: first.description,
        displayName: `${first.displayName || first.name} (main)`,
        name: first.name,
      },
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
 * questions before it. The answer's text comes as it is written; the changes it proposes, checked
 * by bkn-project, come at the end. Nothing of the draft is changed; aborting stops bkn-project
 * asking too.
 */
export async function askDraftItem(request: AskRequest): Promise<AskAnswer> {
  if (useMock) {
    return askMock(request);
  }
  const { apiBaseUrl, auth, locale } = getRuntimeConfig();
  const url = `${apiBaseUrl}${API_PREFIX}/${encodeURIComponent(request.projectId)}/ontology/draft/${request.kind}/${encodeURIComponent(request.itemId)}/ask`;
  // Signed in as the page is, once more with a fresh token when the one it had expired.
  const post = (init: RequestInit, token: string | null) => {
    const headers = new Headers(init.headers);
    headers.set("Accept-Language", locale);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return fetch(url, { ...init, headers });
  };
  const working = request.working
    ? request.kind === "object_types"
      ? objectTypeBody(request.working)
      : relationBody(request.working)
    : undefined;
  let written = "";
  try {
    const init: RequestInit = {
      body: JSON.stringify({
        history: request.history.slice(-ASK_HISTORY_TURNS),
        question: request.question,
        ...(working ? { working } : {}),
      }),
      headers: { Accept: "text/event-stream", "Content-Type": "application/json" },
      method: "POST",
      signal: request.signal,
    };
    let response = await post(init, auth.tokenManager.getAccessToken());
    if (response.status === 401) {
      const fresh = await auth.tokenManager.refreshAccessToken().catch(() => null);
      if (fresh) {
        response = await post(init, fresh);
      }
    }
    if (!response.ok || !response.body) {
      // Refused before answering: a plain error.
      throw new AskError(codeOf(await response.json().catch(() => null)));
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
      const frames = buffer.split("\n\n");
      buffer = done ? "" : (frames.pop() ?? "");
      for (const frame of frames) {
        const parsed = parseFrame(frame);
        const data = asRecord(parsed?.data);
        if (parsed?.name === "token" && typeof data?.content === "string") {
          written += data.content;
          request.onText(data.content);
        } else if (parsed?.name === "result") {
          // bkn-project tidies the answer it ends with; that one stands.
          const answer = mapAnswer(data);
          return { ...answer, answer: answer.answer || written };
        } else if (parsed?.name === "error") {
          throw new AskError(codeOf(data), text(data?.answer) || written);
        }
      }
      if (done) {
        // The stream ended with neither its result nor an error.
        throw new AskError("other", written);
      }
    }
  } catch (error) {
    if (error instanceof AskError) {
      throw error;
    }
    throw new AskError(request.signal?.aborted ? "aborted" : "other", written);
  }
}
