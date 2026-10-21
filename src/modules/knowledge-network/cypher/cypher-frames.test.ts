/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  MAX_FRAMES,
  MAX_STORED_RESULT_CHARS,
  loadFrames,
  pushFrame,
  saveFrames,
  storableFrames,
  type CypherFrame,
} from "./cypher-frames";

function frame(id: string, extra: Partial<CypherFrame> = {}): CypherFrame {
  return { id, createdAt: 0, query: `RETURN ${id}`, status: "done", ...extra };
}

beforeEach(() => localStorage.clear());

describe("cypher frames", () => {
  it("puts the newest frame on top and keeps at most the limit", () => {
    let frames: CypherFrame[] = [];
    for (let index = 0; index < MAX_FRAMES + 2; index += 1)
      frames = pushFrame(frames, frame(`f${index}`));
    expect(frames).toHaveLength(MAX_FRAMES);
    expect(frames[0].id).toBe(`f${MAX_FRAMES + 1}`);
    expect(frames[frames.length - 1].id).toBe("f2");
  });

  it("stores settled frames per network and reads them back", () => {
    saveFrames("kn_a", [
      frame("running", { status: "running" }),
      frame("done", { result: { columns: [{ name: "n" }], entries: [{ n: 79 }] } }),
      frame("failed", { status: "error", error: { message: "bad" } }),
    ]);
    expect(loadFrames("kn_a").map((item) => item.id)).toEqual(["done", "failed"]);
    expect(loadFrames("kn_a")[0].result?.entries).toEqual([{ n: 79 }]);
    expect(loadFrames("kn_b")).toEqual([]);
  });

  it("keeps a large result's frame without the result", () => {
    const big = "x".repeat(MAX_STORED_RESULT_CHARS);
    const [stored] = storableFrames([
      frame("big", { result: { columns: [{ name: "s" }], entries: [{ s: big }] } }),
    ]);
    expect(stored.result).toBeUndefined();
    expect(stored.resultDropped).toBe(true);
  });

  it("drops the Agent's live tool list but keeps the question, answer and thread", () => {
    const [stored] = storableFrames([
      frame("ai", { ai: { question: "q", answer: "a", threadId: "t", tools: ["run_cypher"] } }),
    ]);
    expect(JSON.parse(JSON.stringify(stored.ai))).toEqual({
      question: "q",
      answer: "a",
      threadId: "t",
    });
  });

  it("ignores unreadable storage", () => {
    localStorage.setItem("bkn-studio.cypher-frames.kn_a", "{not json");
    expect(loadFrames("kn_a")).toEqual([]);
  });
});
