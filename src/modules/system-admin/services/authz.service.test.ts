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
});
