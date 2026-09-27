/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  hasRequestableObjectTypePermission,
  hasRequestableObjectTypePolicyScope,
  togglePermissionRequestOperation,
} from "./resource-permission-request";

describe("togglePermissionRequestOperation", () => {
  it("does not resubmit an already effective prerequisite", () => {
    const selected = togglePermissionRequestOperation([], "modify", [
      { key: "modify", requires: ["view_detail"] },
    ]);

    expect(selected).toEqual(["modify"]);
  });

  it("includes a prerequisite only when it is also requestable", () => {
    const selected = togglePermissionRequestOperation([], "modify", [
      { key: "view_detail", requires: [] },
      { key: "modify", requires: ["view_detail"] },
    ]);

    expect(selected).toEqual(["view_detail", "modify"]);
  });
});

describe("hasRequestableObjectTypePolicyScope", () => {
  it("only exposes the entry for an actual row or property restriction", () => {
    expect(hasRequestableObjectTypePolicyScope({})).toBe(false);
    expect(
      hasRequestableObjectTypePolicyScope({
        row_filter: { policy: { conditions: [{ property_name: "region" }] } },
      }),
    ).toBe(true);
    expect(
      hasRequestableObjectTypePolicyScope({
        property_grants: { entries: [{ level: "masked" }] },
      }),
    ).toBe(true);
  });
});

describe("hasRequestableObjectTypePermission", () => {
  it("does not offer an empty object-type request form", () => {
    expect(
      hasRequestableObjectTypePermission({
        hasPendingRequest: false,
        hasRowFilter: false,
        missingOperationCount: 0,
        restrictedPropertyCount: 0,
      }),
    ).toBe(false);
  });

  it("keeps row and property scope requests available when base operations are complete", () => {
    expect(
      hasRequestableObjectTypePermission({
        hasPendingRequest: false,
        hasRowFilter: true,
        missingOperationCount: 0,
        restrictedPropertyCount: 0,
      }),
    ).toBe(true);
    expect(
      hasRequestableObjectTypePermission({
        hasPendingRequest: false,
        hasRowFilter: false,
        missingOperationCount: 0,
        restrictedPropertyCount: 1,
      }),
    ).toBe(true);
  });
});
