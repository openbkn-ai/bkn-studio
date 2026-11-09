/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  DefinitionStillReferencedError,
  definitionsInDetails,
  isDefinitionLevelRefusal,
  throwIfStillReferenced,
} from "@/modules/knowledge-network/services/shared/definition-refusals";

const backendError = (status: number, code: string, details: unknown) => ({
  isAxiosError: true,
  response: { data: { description: "refused", error_code: code, error_details: details }, status },
});

describe("definitionsInDetails", () => {
  it("names the replacement with the kind of the definition that points at it", () => {
    expect(
      definitionsInDetails(
        'object type "legacy_doctor" lifecycle replaced_by "doctor_v2": that object type is deprecated too; replace with one in use',
        { id: "doctor_v2", kind: "object_type" },
      ),
    ).toEqual([{ id: "legacy_doctor", kind: "object_type" }]);
  });

  it("names a relation that must follow a deprecated endpoint", () => {
    expect(
      definitionsInDetails(
        'relation type "order_by_doctor": endpoint object type "doctor" is deprecated, so the relation is deprecated too',
        { id: "doctor", kind: "object_type" },
      ),
    ).toEqual([{ id: "order_by_doctor", kind: "relation_type" }]);
  });

  it("names the definition an alias collides with, once", () => {
    expect(
      definitionsInDetails(
        'object type "patient" alias "医生" is the name of object type "doctor"; object type "nurse" alias "医生" is the name of object type "doctor"',
        { id: "patient", kind: "object_type" },
      ),
    ).toEqual([
      { id: "doctor", kind: "object_type" },
      { id: "nurse", kind: "object_type" },
    ]);
  });
});

describe("isDefinitionLevelRefusal", () => {
  it("tells a refusal of the aliases or lifecycle from one of a property", () => {
    expect(isDefinitionLevelRefusal({ details: 'object type "p": alias "x" appears twice' })).toBe(
      true,
    );
    expect(
      isDefinitionLevelRefusal({ details: 'object type "p": status deprecated needs a reason' }),
    ).toBe(true);
    expect(
      isDefinitionLevelRefusal({
        details: 'data property "name" aliases: alias "x" appears twice',
        property: "name",
      }),
    ).toBe(false);
  });
});

describe("throwIfStillReferenced", () => {
  it("throws the references of a definition another one still replaces with", () => {
    const references = [
      'object type "doctor" is the lifecycle replaced_by of object type "legacy"',
    ];
    let thrown: unknown;
    try {
      throwIfStillReferenced(
        backendError(409, "BknBackend.ObjectType.StillReferenced", { references }),
        { id: "doctor", kind: "object_type" },
      );
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(DefinitionStillReferencedError);
    expect((thrown as DefinitionStillReferencedError).references).toEqual(references);
  });

  it("leaves any other error alone", () => {
    expect(() =>
      throwIfStillReferenced(backendError(500, "BknBackend.ObjectType.InternalError", {}), {
        id: "doctor",
        kind: "object_type",
      }),
    ).not.toThrow();
  });
});
