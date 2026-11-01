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
function stream(frames: string[]) {
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
    { headers: { "Content-Type": "text/event-stream" }, status: 200 },
  );
}

const frame = (name: string, data: unknown) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;

const base = { history: [], itemId: "po 1", projectId: "p/1", question: "Q?" };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("askDraftItem", () => {
  it("streams the answer, sends what is being edited, and ends with the checked changes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      stream([
        frame("token", { content: "Wards hold " }),
        frame("token", { content: "beds.  " }),
        frame("result", {
          answer: "Wards hold beds.",
          dropped: [{ field: "display_key", reason: "unknown_property" }],
          revisions: [
            { field: "name", reason: "R", value: "Ward" },
            { field: "primary_keys", reason: "", value: ["ward_no", "floor"] },
            {
              field: "data_property",
              reason: "",
              value: { comment: "", display_name: "Beds", name: "bed_count" },
            },
            { field: "unknown", reason: "", value: 1 },
          ],
          suggestion: null,
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
        displayKey: "bed_count",
        incrementalKey: "",
        name: "Wards",
        primaryKeys: ["ward_no"],
        properties: [
          {
            description: "",
            displayName: "bed_count",
            mappedField: "bed_count",
            name: "bed_count",
            type: "integer",
          },
        ],
      },
    });

    expect(written).toEqual(["Wards hold ", "beds.  "]);
    // The answer bkn-project tidied stands over what was streamed.
    expect(answer).toEqual({
      answer: "Wards hold beds.",
      dropped: [{ field: "display_key", reason: "unknown_property" }],
      revisions: [
        { field: "name", reason: "R", value: "Ward" },
        { field: "primary_keys", reason: "", value: ["ward_no", "floor"] },
        {
          field: "data_property",
          reason: "",
          value: { comment: "", displayName: "Beds", name: "bed_count" },
        },
      ],
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/bkn-project/v1/projects/p%2F1/ontology/draft/object_types/po%201/ask");
    expect(new Headers(init.headers).get("Accept")).toBe("text/event-stream");
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    // Only the last four turns go back; the editor's values as saving sends them, without a time.
    expect(body.history).toHaveLength(4);
    expect(body).toMatchObject({
      question: "Q?",
      working: {
        data_properties: [{ mapped_field: { name: "bed_count" }, name: "bed_count" }],
        name: "Wards",
        primary_keys: ["ward_no"],
      },
    });
    expect(body).not.toHaveProperty("modelId");
    expect(body.working).not.toHaveProperty("update_time");
  });

  it("reads a relation's ends, joined directly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        stream([
          frame("result", {
            answer: "A",
            dropped: [],
            revisions: [
              {
                field: "ends",
                reason: "",
                value: {
                  mapping_rules: [
                    { source_property: { name: "site_id" }, target_property: { name: "id" } },
                  ],
                  source_object_type_id: "waybill",
                  target_object_type_id: "site",
                  type: "direct",
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
          mapping: [{ sourceProperty: "site_id", targetProperty: "id" }],
          source: "waybill",
          target: "site",
        },
      },
    ]);
  });

  it("asks about a relation being made, with what is filled in so far", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(stream([frame("result", { answer: "A", dropped: [], revisions: [] })]));
    vi.stubGlobal("fetch", fetchMock);
    const { askDraftItem } = await importService();

    await askDraftItem({
      ...base,
      itemId: null,
      kind: "relation_types",
      onText: vi.fn(),
      // Only the source chosen: no target, no mapping, no name yet.
      working: { description: "", mapping: [], name: "", source: "waybill", target: "" },
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/bkn-project/v1/projects/p%2F1/ontology/draft/relation_types:ask");
    expect(JSON.parse(init.body as string)).toMatchObject({
      working: {
        mapping_rules: [],
        name: "",
        source_object_type_id: "waybill",
        target_object_type_id: "",
      },
    });
  });

  it("says why it did not answer, keeping what was written", async () => {
    const { AskError, askDraftItem } = await importService();
    const ask = () => askDraftItem({ ...base, kind: "object_types", onText: vi.fn() });

    // Refused before answering: a plain error.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error_code: "BknProject.Draft.AskUnavailable" }), {
          status: 502,
        }),
      ),
    );
    await expect(ask()).rejects.toEqual(new AskError("AskUnavailable"));

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        stream([
          frame("token", { content: "Half" }),
          frame("error", {
            answer: "Half an answer",
            description: "timed out",
            error_code: "BknProject.Draft.AskTimeout",
          }),
        ]),
      ),
    );
    await expect(ask()).rejects.toMatchObject({ answer: "Half an answer", code: "AskTimeout" });

    // Ended with neither: what was streamed is kept.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(stream([frame("token", { content: "Half" })])),
    );
    await expect(ask()).rejects.toMatchObject({ answer: "Half", code: "other" });
  });
});

describe("document assistant wire format", () => {
  it("retains instruction-only proposals and document join rules", async () => {
    const { mapAnswer } = await importService();
    const result = mapAnswer({
      revisions: [
        {
          field: "data_property",
          value: { name: "number", extraction_instruction: "Read explicit only" },
        },
        {
          field: "ends",
          value: {
            source_object_type_id: "contract_doc",
            target_object_type_id: "order",
            document_mapping: {
              mode: "linking",
              mention_property: "number",
              identity_property: "id",
            },
            cardinality: "many_to_one",
          },
        },
      ],
    });
    expect(result.revisions).toEqual([
      {
        field: "data_property",
        reason: "",
        value: { name: "number", extractionInstruction: "Read explicit only" },
      },
      {
        field: "ends",
        reason: "",
        value: {
          source: "contract_doc",
          target: "order",
          mapping: [],
          documentMapping: { mode: "linking", mentionProperty: "number", identityProperty: "id" },
          cardinality: "many_to_one",
        },
      },
    ]);
  });
});
