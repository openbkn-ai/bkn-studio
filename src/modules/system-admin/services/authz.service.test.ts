/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  listObjectGrants,
  mapObjectGrantEntry,
  upsertObjectGrant,
} from "@/modules/system-admin/services/authz.service";

describe("object-grant backend contract", () => {
  it("keeps repeated mock writes for the same operation idempotent", async () => {
    const input = {
      accessorId: "test-idempotent-user",
      effect: "allow" as const,
      objId: "test-idempotent-object",
      objName: "Idempotent object",
      objType: "object_type",
      operations: ["view_detail"],
    };

    await upsertObjectGrant(input);
    await upsertObjectGrant(input);
    const result = await listObjectGrants({
      accessorId: input.accessorId,
      resourceId: input.objId,
      resourceType: input.objType,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.grants?.filter((source) => source.operation === "view_detail"))
      .toHaveLength(1);
  });

  it("replaces the mock professional-rule operation slice", async () => {
    const input = {
      accessorId: "test-replacement-user",
      effect: "allow" as const,
      objId: "test-replacement-object",
      objName: "Replacement object",
      objType: "object_type",
      operations: ["view_detail", "modify"],
    };

    await upsertObjectGrant(input);
    await upsertObjectGrant({ ...input, operations: ["query_data"] });
    const result = await listObjectGrants({
      accessorId: input.accessorId,
      resourceId: input.objId,
      resourceType: input.objType,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.operations).toEqual(["query_data"]);
    expect(result[0]?.grants?.map((source) => source.operation)).toEqual(["query_data"]);
  });

  it("keeps source records and effective decisions separate", () => {
    const result = mapObjectGrantEntry({
      accessor_id: "user-1",
      denied_operations: ["modify"],
      effective_decisions: [{
        basis: "requires",
        decision: "deny",
        denied_requirement: "view_detail",
        operation: "modify",
        requires: ["view_detail"],
      }],
      grants: [
        {
          active: true,
          accessor_id: "user-1",
          authority_source: "admin_authz",
          effect: "allow",
          grant_id: "grant-allow-modify",
          inherited: false,
          operation: "modify",
          policy_source: "professional_rule",
        },
        {
          active: true,
          accessor_id: "user-1",
          authority_source: "admin_authz",
          effect: "deny",
          grant_id: "grant-deny-view",
          inherited: false,
          operation: "view_detail",
          policy_source: "professional_rule",
        },
      ],
      operations: ["modify"],
      resource: { id: "catalog-1", type: "catalog" },
    });

    expect(result.grants?.map((grant) => grant.grantId)).toEqual([
      "grant-allow-modify",
      "grant-deny-view",
    ]);
    expect(result.effectiveDecisions).toEqual([
      expect.objectContaining({
        basis: "requires",
        decision: "deny",
        deniedRequirement: "view_detail",
        operation: "modify",
      }),
    ]);
    expect(result.deniedOperations).toEqual(["modify"]);
  });

  it("treats a source without an active flag as active", () => {
    const result = mapObjectGrantEntry({
      accessor_id: "user-1",
      grants: [{
        accessor_id: "user-1",
        authority_source: "admin_authz",
        effect: "allow",
        grant_id: "grant-without-active",
        inherited: false,
        operation: "view_detail",
        policy_source: "professional_rule",
      }],
      operations: ["view_detail"],
      resource: { id: "catalog-1", type: "catalog" },
    });

    expect(result.grants?.[0]).toEqual(expect.objectContaining({
      active: true,
      grantId: "grant-without-active",
    }));
  });

  it("keeps grantee display fields returned by the object-scoped API", () => {
    const result = mapObjectGrantEntry({
      accessor_account: "b",
      accessor_id: "user-1",
      accessor_name: "普通用户 B",
      operations: ["view_detail"],
      resource: { id: "catalog-1", type: "catalog" },
    });

    expect(result).toMatchObject({
      accessorAccount: "b",
      accessorId: "user-1",
      accessorName: "普通用户 B",
    });
  });
});
