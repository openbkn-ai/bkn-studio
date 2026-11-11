/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { DefinitionDeclarations } from "@/modules/knowledge-network/types/knowledge-network";
import {
  areDefinitionDeclarationsEqual,
  definitionAliasProblem,
  fromDefinitionDeclarationForm,
  normalizeDefinitionDeclarations,
  replacementCandidates,
  toDefinitionDeclarationForm,
} from "@/modules/knowledge-network/utils/definition-declarations";

const deprecated: DefinitionDeclarations = {
  lifecycle: { reason: "Old codes", replacedBy: "doctor", status: "deprecated" },
};

describe("normalizeDefinitionDeclarations", () => {
  it("drops empty aliases and a lifecycle that is not deprecated", () => {
    expect(normalizeDefinitionDeclarations({ aliases: [" ", ""] })).toBeUndefined();
    expect(
      normalizeDefinitionDeclarations({
        aliases: [" 病人 ", "就诊人"],
        lifecycle: { reason: "", status: "active" as "deprecated" },
      }),
    ).toEqual({ aliases: ["病人", "就诊人"] });
  });

  it("keeps the order the user gave the aliases", () => {
    expect(
      areDefinitionDeclarationsEqual(
        { aliases: ["病人", "就诊人"] },
        { aliases: ["就诊人", "病人"] },
      ),
    ).toBe(false);
  });
});

describe("definitionAliasProblem", () => {
  it("refuses an alias that is the definition's own name", () => {
    expect(definitionAliasProblem(["患者"], ["患者 "])).toEqual({
      key: "ownName",
      params: { alias: "患者" },
    });
  });

  it("refuses more than ten aliases, a comma, a repeat and a long alias", () => {
    expect(
      definitionAliasProblem(
        Array.from({ length: 11 }, (_, i) => `a${i}`),
        [],
      )?.key,
    ).toBe("tooMany");
    expect(definitionAliasProblem(["病人，就诊人"], [])?.key).toBe("comma");
    expect(definitionAliasProblem(["病人", "病人"], [])?.key).toBe("duplicate");
    expect(definitionAliasProblem(["x".repeat(41)], [])?.key).toBe("tooLong");
    expect(definitionAliasProblem(["病人", "就诊人"], ["患者"])).toBeNull();
  });
});

describe("definition declaration form", () => {
  it("reads and writes back the declarations unchanged", () => {
    const stored: DefinitionDeclarations = { aliases: ["医师"], ...deprecated };
    expect(fromDefinitionDeclarationForm(toDefinitionDeclarationForm(stored))).toEqual(stored);
    expect(toDefinitionDeclarationForm(undefined)).toMatchObject({
      aliases: [],
      lifecycleStatus: "active",
    });
  });

  it("drops the reason and replacement when set back to active", () => {
    expect(
      fromDefinitionDeclarationForm({
        ...toDefinitionDeclarationForm(deprecated),
        lifecycleStatus: "active",
      }),
    ).toBeUndefined();
  });
});

describe("replacementCandidates", () => {
  it("offers the definitions in use other than the one edited", () => {
    const items = [
      { id: "doctor" },
      { id: "legacy_doctor", ...{ declarations: deprecated } },
      { id: "nurse" },
    ];
    expect(replacementCandidates(items, "nurse").map((item) => item.id)).toEqual(["doctor"]);
    expect(replacementCandidates(items, undefined).map((item) => item.id)).toEqual([
      "doctor",
      "nurse",
    ]);
  });
});
