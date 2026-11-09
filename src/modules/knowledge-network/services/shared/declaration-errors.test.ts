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
  readDeclarationRefusal,
  readStillReferencedRefusal,
  relationTypesInDetails,
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

describe("readDeclarationRefusal", () => {
  const refusal = (data: Record<string, unknown>) => ({ response: { data, status: 400 } });

  it.each([
    ['data property "status": semantic status needs type string, keyword or integer', "status"],
    ['data properties "lat" and "lon": crs differs', "lat"],
    ['property constraints "fee": value type amount_cny is based on decimal', "fee"],
    ["aliases: too many", undefined],
  ])("reads %s as a refusal of property %s", (details, property) => {
    expect(
      readDeclarationRefusal(
        refusal({
          description: "Invalid declarations",
          error_code: "BknBackend.ObjectType.InvalidParameter.Declarations",
          error_details: details,
        }),
      ),
    ).toEqual({
      description: "Invalid declarations",
      details,
      ...(property ? { property } : {}),
    });
  });

  it("falls back to the code when the backend gives no description or details", () => {
    expect(
      readDeclarationRefusal(
        refusal({ error_code: "BknBackend.RelationType.InvalidParameter.Declarations" }),
      ),
    ).toEqual({ description: "BknBackend.RelationType.InvalidParameter.Declarations" });
  });

  it.each([
    ["another refusal", refusal({ error_code: "BknBackend.ObjectType.InvalidParameter" })],
    ["no backend reply", new Error("Network Error")],
    ["nothing", undefined],
  ])("reads %s as no declaration refusal", (_, error) => {
    expect(readDeclarationRefusal(error)).toBeUndefined();
  });
});

describe("relationTypesInDetails", () => {
  it("finds each relation type a refusal of the fallback rules names, once", () => {
    expect(
      relationTypesInDetails(
        'relation type "order_for_patient_by_id_card" fallback_for "order_for_patient": the relation it stands in for is secondary; a fallback path stands in for a primary relation; relation type "order_for_patient_by_id_card" fallback_for "order_for_patient": relation type "by_phone" is already its fallback path; a primary relation has one',
      ),
    ).toEqual(["order_for_patient_by_id_card", "order_for_patient", "by_phone"]);
  });

  it("finds none in details that name no relation type", () => {
    expect(
      relationTypesInDetails(
        "a symmetric relation reads the same both ways, so it has no reverse_name",
      ),
    ).toEqual([]);
    expect(relationTypesInDetails(undefined)).toEqual([]);
  });
});

describe("readStillReferencedRefusal", () => {
  const conflict = (data: Record<string, unknown>) => ({ response: { data, status: 409 } });

  it("reads the references and the relation types that make them", () => {
    expect(
      readStillReferencedRefusal(
        conflict({
          description: "Still referenced",
          error_code: "BknBackend.RelationType.StillReferenced",
          error_details: {
            references: [
              'relation type "order_for_patient" is the fallback_for of relation type "order_for_patient_by_id_card"',
            ],
          },
        }),
      ),
    ).toEqual({
      description: "Still referenced",
      referringRelationTypeIds: ["order_for_patient_by_id_card"],
      references: [
        'relation type "order_for_patient" is the fallback_for of relation type "order_for_patient_by_id_card"',
      ],
    });
  });

  it("reads any other error as no such refusal", () => {
    expect(
      readStillReferencedRefusal(conflict({ error_code: "BknBackend.RelationType.NotFound" })),
    ).toBeUndefined();
  });
});
