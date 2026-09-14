/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  defaultMaskPreviewInput,
  isMaskRuleValid,
  maskRuleKindsForPropertyType,
  previewMaskRule,
} from "@/modules/knowledge-network/utils/mask-rule";

describe("mask-rule", () => {
  it("uses a rule-specific email preview input", () => {
    expect(defaultMaskPreviewInput("string", "email")).toBe("zhangsan@example.com");
    expect(defaultMaskPreviewInput("string", "partial")).toBe("13812345678");
  });

  it("only offers rules compatible with the property type", () => {
    expect(maskRuleKindsForPropertyType("string")).toEqual(["fixed", "partial", "email"]);
    expect(maskRuleKindsForPropertyType(" VARCHAR ")).toEqual(["fixed", "partial", "email"]);
    expect(maskRuleKindsForPropertyType("decimal")).toEqual(["round"]);
    expect(maskRuleKindsForPropertyType("double")).toEqual(["round"]);
    expect(maskRuleKindsForPropertyType("bigint")).toEqual(["round"]);
    expect(maskRuleKindsForPropertyType("date")).toEqual(["date_granularity"]);
    expect(maskRuleKindsForPropertyType("json")).toEqual([]);
  });

  it("validates replacement code points and parameter bounds", () => {
    expect(isMaskRuleValid("string", { kind: "fixed", replacement: "保密" })).toBe(true);
    expect(isMaskRuleValid("string", { kind: "fixed", replacement: "123456789" })).toBe(false);
    expect(
      isMaskRuleValid("string", {
        keepEnd: 4,
        keepStart: 65,
        kind: "partial",
        replacement: "*",
      }),
    ).toBe(false);
  });

  it("previews partial and email masking without exposing short values", () => {
    expect(
      previewMaskRule(
        "string",
        { keepEnd: 4, keepStart: 3, kind: "partial", replacement: "*" },
        "13812345678",
      ),
    ).toBe("138****5678");
    expect(
      previewMaskRule(
        "string",
        { kind: "email", localKeepStart: 1, preserveDomain: true, replacement: "*" },
        "zhangsan@example.com",
      ),
    ).toBe("z*******@example.com");
    expect(
      previewMaskRule(
        "string",
        { keepEnd: 9, keepStart: 9, kind: "partial", replacement: "*" },
        "a",
      ),
    ).toBe("*");
  });

  it("previews number and date rules", () => {
    expect(previewMaskRule("integer", { kind: "round", step: 1000 }, "123456")).toBe(
      "123000",
    );
    expect(
      previewMaskRule(
        "date",
        { granularity: "year", kind: "date_granularity" },
        "1990-03-18",
      ),
    ).toBe("1990-01-01");
  });
});
