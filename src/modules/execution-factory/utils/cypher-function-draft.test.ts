/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  cypherDraftInputs,
  readCypherFunctionDraft,
  withoutCypherFunctionDraft,
} from "./cypher-function-draft";

describe("cypherDraftInputs", () => {
  it("types each parameter by the value it was tried with, keeping the value as its example", () => {
    expect(
      cypherDraftInputs(["code", "min", "ids", "open"], {
        code: { type: "string", value: "76904023" },
        min: { type: "number", value: 5 },
        ids: { type: "array", itemType: "number", value: [1, 2] },
        open: null,
      }),
    ).toEqual([
      { name: "code", type: "string", required: true, description: "", example: "76904023" },
      { name: "min", type: "number", required: true, description: "", example: 5 },
      {
        name: "ids",
        type: "array",
        required: true,
        description: "",
        example: [1, 2],
        sub_parameters: [{ name: "items", type: "number" }],
      },
      { name: "open", type: "string", required: true, description: "" },
    ]);
  });
});

describe("cypher function draft state", () => {
  const state = { returnTo: "/kn", cypherDraft: { query: "RETURN 1", knId: "kn-1" } };

  it("reads the draft and drops only it", () => {
    expect(readCypherFunctionDraft(state)).toEqual({
      query: "RETURN 1",
      knId: "kn-1",
      inputs: undefined,
    });
    expect(withoutCypherFunctionDraft(state)).toEqual({ returnTo: "/kn" });
  });

  it.each([null, "x", { cypherDraft: { query: 1, knId: "kn" } }])("ignores %j", (value) => {
    expect(readCypherFunctionDraft(value)).toBeUndefined();
  });
});
