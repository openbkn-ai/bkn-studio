/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  explainRowFilter,
  getRowFilterSnapshot,
  patchRowFilterPolicy,
} from "@/modules/knowledge-network/services/row-filter-authorization.service";

describe("row-filter-authorization.service mock", () => {
  it("writes fixed conditions and restores no extra row filter", async () => {
    const subject = { id: "issue-736-user", type: "user" as const };
    const objectTypeRef = "kn-736/order";
    const initial = await getRowFilterSnapshot(subject, objectTypeRef);
    expect(initial.policy).toBeNull();

    const saved = await patchRowFilterPolicy({
      expectedRevision: initial.revision,
      objectTypeRef,
      policy: {
        relation: "and",
        conditions: [{ operator: "in", propertyName: "region", values: ["east", "south"] }],
      },
      reason: "test",
      subject,
    });
    expect(saved.policy).toEqual({
      relation: "and",
      conditions: [{ operator: "in", propertyName: "region", values: ["east", "south"] }],
    });
    expect(saved.revision).not.toBeNull();

    const explained = await explainRowFilter(subject, objectTypeRef);
    expect(explained.directPolicy?.conditions[0]?.propertyName).toBe("region");
    expect(explained.effectiveRowFilterDigest).toContain("mock-");

    const restored = await patchRowFilterPolicy({
      expectedRevision: saved.revision,
      objectTypeRef,
      policy: null,
      reason: "test restore inheritance",
      subject,
    });
    expect(restored.policy).toBeNull();
    expect(restored.revision).toBeNull();
  });
});
