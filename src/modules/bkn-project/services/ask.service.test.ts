/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/framework/runtime/config", () => ({
  getRuntimeConfig: () => ({
    apiBaseUrl: "/api",
    auth: { tokenManager: { getAccessToken: () => "", refreshAccessToken: () => null } },
    locale: "en-US",
  }),
}));

// useMock is read when the module loads, so each case stubs the env and imports afresh.
async function importService() {
  vi.stubEnv("VITE_USE_MOCK", "false");
  vi.resetModules();
  return import("@/modules/bkn-project/services/ask.service");
}

/** A response streaming the frames, split across reads where a frame may break. */
function stream(frames: string[], status = 200) {
  const encoder = new TextEncoder();
  const text = frames.join("");
  const half = Math.floor(text.length / 2);
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(text.slice(0, half)));
        controller.enqueue(encoder.encode(text.slice(half)));
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" }, status },
  );
}

const frame = (name: string, data: unknown) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;

const base = { history: [], itemId: "po 1", projectId: "p/1", question: "Q?" };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("askDraftItem", () => {
  it("streams the answer, sends what is being edited, and reads the revisions it ends with", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      stream([
        frame("token", { content: "Orders " }),
        frame("token", { content: "are lines." }),
        frame("result", {
          answer: "Orders are lines.",
          dropped: [{ field: "display_key", reason: "unknown_property" }],
          revisions: [
            { field: "name", reason: "R", value: "Order line" },
            { field: "primary_keys", reason: "", value: ["order_no", "line_no"] },
            { field: "property", reason: "", value: { display_name: "Amount", name: "amt" } },
            { field: "unknown", reason: "", value: 1 },
          ],
        }),
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { askDraftItem } = await importService();
    const written: string[] = [];

    const answer = await askDraftItem({
      ...base,
      history: Array.from({ length: 6 }, (_, at) => ({ answer: `A${at}`, question: `Q${at}` })),
      kind: "object_types",
      onText: (text) => written.push(text),
      working: {
        description: "",
        displayKey: "amt",
        incrementalKey: "",
        name: "Orders",
        primaryKeys: ["order_no"],
        properties: [
          { description: "", displayName: "amt", mappedField: "amt", name: "amt", type: "float" },
        ],
      },
    });

    expect(written).toEqual(["Orders ", "are lines."]);
    expect(answer).toEqual({
      answer: "Orders are lines.",
      dropped: [{ field: "display_key", reason: "unknown_property" }],
      revisions: [
        { field: "name", reason: "R", value: "Order line" },
        { field: "primary_keys", reason: "", value: ["order_no", "line_no"] },
        { field: "property", reason: "", value: { displayName: "Amount", name: "amt" } },
      ],
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/bkn-project/v1/projects/p%2F1/ontology/draft/object_types/po%201/ask");
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    // Only the last four turns go back; the editor's values as saving sends them, without a time.
    expect(body.history).toHaveLength(4);
    expect(body).toMatchObject({
      question: "Q?",
      working: {
        data_properties: [{ mapped_field: { name: "amt" }, name: "amt" }],
        name: "Orders",
        primary_keys: ["order_no"],
      },
    });
    expect(body.working).not.toHaveProperty("update_time");
  });

  it("reads a relation's ends, directly or through a link table", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        stream([
          frame("result", {
            answer: "A",
            revisions: [
              {
                field: "ends",
                reason: "",
                value: {
                  mapping_rules: {
                    backing_data_source: { id: "res-link" },
                    source_mapping_rules: [
                      { source_property: { name: "id" }, target_property: { name: "a_id" } },
                    ],
                    target_mapping_rules: [
                      { source_property: { name: "b_id" }, target_property: { name: "id" } },
                    ],
                  },
                  source_object_type_id: "a",
                  target_object_type_id: "b",
                  type: "indirect",
                },
              },
            ],
          }),
        ]),
      ),
    );
    const { askDraftItem } = await importService();

    const answer = await askDraftItem({ ...base, kind: "relation_types", onText: vi.fn() });

    expect(answer.revisions).toEqual([
      {
        field: "ends",
        reason: "",
        value: {
          link: {
            resourceId: "res-link",
            sourceMapping: [{ sourceProperty: "id", targetProperty: "a_id" }],
            targetMapping: [{ sourceProperty: "b_id", targetProperty: "id" }],
          },
          mapping: [],
          source: "a",
          target: "b",
        },
      },
    ]);
  });

  it("says why it did not answer: a refusal, an error mid-answer, or an answer cut short", async () => {
    const { AskError, askDraftItem } = await importService();
    const ask = () => askDraftItem({ ...base, kind: "object_types", onText: vi.fn() });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error_code: "BknProject.Draft.NotReady" }), {
          status: 409,
        }),
      ),
    );
    await expect(ask()).rejects.toEqual(new AskError("NotReady"));

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          stream([
            frame("token", { content: "Half" }),
            frame("error", { error_code: "BknProject.Draft.AskUnavailable" }),
          ]),
        ),
    );
    await expect(ask()).rejects.toMatchObject({ code: "AskUnavailable" });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(stream([frame("token", { content: "Half" })])),
    );
    await expect(ask()).rejects.toMatchObject({ code: "other" });
  });
});
