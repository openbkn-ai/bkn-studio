/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  AskAnswer,
  AskRevision,
  AskTurn,
  DraftObjectTypeSave,
  DraftRelationTypeSave,
} from "@/modules/bkn-project/types/draft";

const useMock = import.meta.env.VITE_USE_MOCK !== "false";

/** How many questions before this one go with it. */
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
  /** The answer model; the platform's default when absent. */
  modelId?: string;
  /** The answer's text as it is written. */
  onText: (text: string) => void;
  projectId: string;
  question: string;
  signal?: AbortSignal;
} & (
  | { kind: "object_types"; working?: DraftObjectTypeSave }
  | { kind: "relation_types"; working?: DraftRelationTypeSave }
);

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
 * questions before it. The answer's text comes as it is written; the changes it proposes come at
 * the end. Nothing of the draft is changed.
 *
 * bkn-project's conversation endpoint is being settled; until it is, only local development
 * answers, and elsewhere the page says AI cannot answer yet.
 */
export async function askDraftItem(request: AskRequest): Promise<AskAnswer> {
  if (useMock) {
    return askMock(request);
  }
  return Promise.reject(new AskError("AskUnavailable"));
}
