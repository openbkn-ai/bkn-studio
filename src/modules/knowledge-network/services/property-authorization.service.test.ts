/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  listPropertyGrantSnapshot,
  patchPropertyGrants,
} from "@/modules/knowledge-network/services/property-authorization.service";

describe("property-authorization.service mock", () => {
  it("patches a subject and restores inheritance transactionally", async () => {
    const accessor = { id: "issue-571-user", type: "user" as const };
    const objectTypeRef = "kn-571/customer";

    const updated = await patchPropertyGrants({
      accessor,
      changes: [
        { level: "masked", propertyName: "mobile" },
        { level: "schema", propertyName: "identity" },
      ],
      objectTypeRef,
      reason: "test",
    });
    expect(updated.changed).toBe(2);
    expect(updated.entries.map((entry) => entry.propertyName)).toEqual(["identity", "mobile"]);

    const restored = await patchPropertyGrants({
      accessor,
      changes: [{ level: "inherit", propertyName: "mobile" }],
      objectTypeRef,
      reason: "test restore",
    });
    expect(restored.changed).toBe(1);

    const snapshot = await listPropertyGrantSnapshot(accessor, objectTypeRef);
    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.entries[0]?.propertyName).toBe("identity");
  });
});
