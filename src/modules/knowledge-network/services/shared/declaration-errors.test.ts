/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  parseClearedDeclarations,
  parseNetworkCheckResult,
} from "@/modules/knowledge-network/services/shared/declaration-errors";

describe("parseClearedDeclarations", () => {
  it("reads which definition each entry belongs to from the id it carries", () => {
    expect(
      parseClearedDeclarations({
        cleared: [
          { fields: ["aliases", "lifecycle"], object_type_id: "lab_order" },
          { fields: ["constraints"], object_type_id: "lab_order", property: "status" },
          { fields: ["reverse_name"], relation_type_id: "ordered_by" },
          { action_type_id: "revoke", fields: ["aliases"] },
        ],
      }),
    ).toEqual([
      { fields: ["aliases", "lifecycle"], id: "lab_order", kind: "object_type" },
      { fields: ["constraints"], id: "lab_order", kind: "object_type", property: "status" },
      { fields: ["reverse_name"], id: "ordered_by", kind: "relation_type" },
      { fields: ["aliases"], id: "revoke", kind: "action_type" },
    ]);
  });

  it("keeps a declaration name it does not know, so the list stays complete", () => {
    expect(
      parseClearedDeclarations({ cleared: [{ fields: ["future_field"], object_type_id: "a" }] }),
    ).toEqual([{ fields: ["future_field"], id: "a", kind: "object_type" }]);
  });

  it.each([
    ["no details", undefined],
    ["text details", "declarations would be cleared"],
    ["a list that is not one", { cleared: "lab_order" }],
  ])("reads %s as an empty list", (_, details) => {
    expect(parseClearedDeclarations(details)).toEqual([]);
  });

  it("leaves out entries without a definition id or a field", () => {
    expect(
      parseClearedDeclarations({
        cleared: [
          null,
          { fields: ["aliases"] },
          { fields: [], object_type_id: "a" },
          { fields: [1, ""], object_type_id: "b" },
          { fields: ["aliases"], object_type_id: "c" },
        ],
      }),
    ).toEqual([{ fields: ["aliases"], id: "c", kind: "object_type" }]);
  });
});

describe("parseNetworkCheckResult", () => {
  it("reads missing lists as empty", () => {
    expect(parseNetworkCheckResult(undefined)).toEqual({
      invalidParameters: [],
      misplacedParameters: [],
    });
    expect(parseNetworkCheckResult({ misplaced_parameters: null })).toEqual({
      invalidParameters: [],
      misplacedParameters: [],
    });
  });

  it("reads conflict as set only when the backend says true", () => {
    const result = parseNetworkCheckResult({
      misplaced_parameters: [
        { current: {}, parameter: "a", suggested: {} },
        { conflict: "yes", current: {}, parameter: "b", suggested: {} },
        { conflict: true, current: {}, parameter: "c", suggested: {} },
      ],
    });

    expect(result.misplacedParameters.map((item) => item.conflict)).toEqual([false, false, true]);
  });

  it("keeps a constant value whatever its type", () => {
    const result = parseNetworkCheckResult({
      invalid_parameters: [{ current: { value: { days: 7 }, value_from: "env" }, parameter: "p" }],
    });

    expect(result.invalidParameters[0]?.current).toEqual({
      source: undefined,
      value: { days: 7 },
      valueFrom: "env",
    });
  });
});
