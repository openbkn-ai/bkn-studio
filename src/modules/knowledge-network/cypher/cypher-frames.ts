/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  CypherExchange,
  CypherRunError,
} from "@/modules/knowledge-network/cypher/cypher-query.service";
import type { FrameGraphSettings } from "@/modules/knowledge-network/cypher/graph-style";
import type { CypherResult } from "@/modules/knowledge-network/cypher/graph-values";

/**
 * The OpenCypher page's result stream: each run adds a frame on top, like Neo4j Browser. The
 * settled frames are kept in this browser per network, so a reload shows the same stream.
 */

export const MAX_FRAMES = 10;

/** Past this many characters a frame is kept without its result, to stay within storage. */
export const MAX_STORED_RESULT_CHARS = 200_000;

export type CypherFrameStatus = "generating" | "running" | "done" | "error";

export type CypherFrame = {
  id: string;
  createdAt: number;
  /** The query run, or "" while the Agent is still writing it. */
  query: string;
  status: CypherFrameStatus;
  /** Set when the Agent wrote the query: the question, its answer and the thread to continue. */
  ai?: { question: string; answer?: string; threadId?: string; tools?: string[] };
  /** The Agent could not give a query. */
  generationError?: string;
  result?: CypherResult;
  error?: CypherRunError;
  exchange?: CypherExchange;
  /** The result was too large to keep in storage; run the query again to see it. */
  resultDropped?: boolean;
  /** The Agent's explanation of the query, asked for from the frame or the editor. */
  explanation?: { status: "running" | "done" | "error"; text?: string; tools?: string[] };
  /** How this frame's graph draws and moves, changed from the graph's own settings. */
  graphSettings?: FrameGraphSettings;
};

let sequence = 0;

export function newFrameId(): string {
  sequence += 1;
  return `${Date.now().toString(36)}-${sequence}`;
}

/** Puts a frame on top and drops the oldest past the limit. */
export function pushFrame(frames: readonly CypherFrame[], frame: CypherFrame): CypherFrame[] {
  return [frame, ...frames.filter((item) => item.id !== frame.id)].slice(0, MAX_FRAMES);
}

export function updateFrame(
  frames: readonly CypherFrame[],
  id: string,
  change: (frame: CypherFrame) => CypherFrame,
): CypherFrame[] {
  return frames.map((frame) => (frame.id === id ? change(frame) : frame));
}

function storageKey(knId: string): string {
  return `bkn-studio.cypher-frames.${knId}`;
}

/** What goes to storage: settled frames, without results too large to keep. */
export function storableFrames(frames: readonly CypherFrame[]): CypherFrame[] {
  return frames
    .filter((frame) => frame.status === "done" || frame.status === "error")
    .map((frame) => {
      const tools = frame.ai ? { ...frame.ai, tools: undefined } : undefined;
      // An explanation still being written is not kept; a finished one is.
      const explanation =
        frame.explanation && frame.explanation.status !== "running"
          ? { ...frame.explanation, tools: undefined }
          : undefined;
      const base: CypherFrame = { ...frame, ...(tools ? { ai: tools } : {}), explanation };
      const size = JSON.stringify(base.result ?? null).length;
      const exchangeSize = JSON.stringify(base.exchange ?? null).length;
      if (size + exchangeSize <= MAX_STORED_RESULT_CHARS) return base;
      return { ...base, result: undefined, exchange: undefined, resultDropped: true };
    });
}

function isFrame(value: unknown): value is CypherFrame {
  if (typeof value !== "object" || value === null) return false;
  const frame = value as Partial<CypherFrame>;
  return (
    typeof frame.id === "string" &&
    typeof frame.query === "string" &&
    (frame.status === "done" || frame.status === "error")
  );
}

export function loadFrames(knId: string): CypherFrame[] {
  try {
    const raw = localStorage.getItem(storageKey(knId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isFrame).slice(0, MAX_FRAMES) : [];
  } catch {
    return [];
  }
}

export function saveFrames(knId: string, frames: readonly CypherFrame[]): void {
  try {
    localStorage.setItem(storageKey(knId), JSON.stringify(storableFrames(frames)));
  } catch {
    /* Private mode or exhausted quota: the stream still works for this visit. */
  }
}
