/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  areRelationDeclarationsEqual,
  fitRelationDeclarations,
  normalizeRelationDeclarations,
  relationSentenceParts,
} from "./relation-declarations";

const sameEnds = { sourceObjectTypeId: "department", targetObjectTypeId: "department" };
const otherEnds = { sourceObjectTypeId: "doctor", targetObjectTypeId: "department" };

describe("normalizeRelationDeclarations", () => {
  it("drops what declares nothing, and keeps a fallback path only on a secondary relation", () => {
    expect(
      normalizeRelationDeclarations({
        characteristics: [],
        constraintsPassthrough: {},
        fallbackFor: "order_for_patient",
        requiredEnds: [],
        reverseName: "  ",
      }),
    ).toBeUndefined();
  });

  it("puts lists in a fixed order, so equal declarations compare equal", () => {
    expect(
      areRelationDeclarationsEqual(
        { characteristics: ["transitive", "symmetric"], requiredEnds: ["target", "source"] },
        { characteristics: ["symmetric", "transitive"], requiredEnds: ["source", "target"] },
      ),
    ).toBe(true);
  });
});

describe("fitRelationDeclarations", () => {
  it("clears the characteristics of a relation whose ends differ", () => {
    expect(fitRelationDeclarations({ characteristics: ["transitive"] }, otherEnds)).toEqual({
      cleared: ["characteristics"],
      value: undefined,
    });
  });

  it("clears what a symmetric relation cannot declare", () => {
    expect(
      fitRelationDeclarations(
        {
          cardinality: "many_to_one",
          characteristics: ["symmetric"],
          requiredEnds: ["source"],
          reverseName: "下辖",
        },
        sameEnds,
      ),
    ).toEqual({
      cleared: ["reverseName", "cardinality", "requiredEnds"],
      value: { characteristics: ["symmetric"] },
    });
  });

  it("keeps what a symmetric relation can declare", () => {
    const value = {
      cardinality: "many_to_many" as const,
      characteristics: ["symmetric" as const],
      requiredEnds: ["source" as const, "target" as const],
    };
    expect(fitRelationDeclarations(value, sameEnds)).toEqual({ cleared: [], value });
  });
});

describe("relationSentenceParts", () => {
  it("says how many targets a source has, then how many sources a target has", () => {
    expect(relationSentenceParts({ cardinality: "many_to_one", requiredEnds: ["source"] })).toEqual(
      [
        { count: "exactlyOne", from: "source" },
        { count: "several", from: "target" },
      ],
    );
    expect(relationSentenceParts({ cardinality: "one_to_many", requiredEnds: ["target"] })).toEqual(
      [
        { count: "several", from: "source" },
        { count: "exactlyOne", from: "target" },
      ],
    );
    expect(relationSentenceParts({ cardinality: "one_to_one" })).toEqual([
      { count: "atMostOne", from: "source" },
      { count: "atMostOne", from: "target" },
    ]);
  });

  it("says only the required ends when the cardinality is not declared", () => {
    expect(relationSentenceParts({ requiredEnds: ["target"] })).toEqual([
      { count: "atLeastOne", from: "target" },
    ]);
    expect(relationSentenceParts(undefined)).toEqual([]);
  });

  it("reads many_to_many with both ends required as one or more both ways", () => {
    expect(
      relationSentenceParts({ cardinality: "many_to_many", requiredEnds: ["source", "target"] }),
    ).toEqual([
      { count: "oneOrMore", from: "source" },
      { count: "oneOrMore", from: "target" },
    ]);
  });
});
