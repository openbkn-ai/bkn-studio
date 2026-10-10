/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  canRequestResourcePermission,
  getEffectiveRowFilterPolicies,
  hasEffectiveRowFilter,
  hasRequestableObjectTypePermission,
  hasRequestableObjectTypePolicyScope,
  isPermissionRequestPrefillReady,
  isPermissionRequestProposalReady,
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
    expect(
      hasRequestableObjectTypePolicyScope({
        row_filter: {
          effective_policies: [
            {
              conditions: [{ operator: "in", property_name: "region", values: ["east"] }],
              relation: "and",
            },
          ],
          effective_policy_present: true,
        },
      }),
    ).toBe(true);
  });
});

describe("effective row-filter previews", () => {
  const rolePolicy = {
    conditions: [{ operator: "in", property_name: "region", values: ["east"] }],
    relation: "and" as const,
  };

  it("prefers the complete effective policy list over the legacy direct policy", () => {
    expect(
      getEffectiveRowFilterPolicies({
        effective_policies: [rolePolicy],
        policy: { ...rolePolicy, conditions: [] },
      }),
    ).toEqual([rolePolicy]);
  });

  it("uses the effective presence flag even when no legacy policy is returned", () => {
    expect(hasEffectiveRowFilter({ effective_policy_present: true, policy: null })).toBe(true);
  });

  it("keeps compatibility with legacy previews", () => {
    expect(getEffectiveRowFilterPolicies({ policy: rolePolicy })).toEqual([rolePolicy]);
    expect(hasEffectiveRowFilter({ policy: rolePolicy })).toBe(true);
  });
});

describe("isPermissionRequestProposalReady", () => {
  it("waits for the object-type policy preview before allowing a policy proposal", () => {
    expect(
      isPermissionRequestProposalReady({
        proposalKind: "row_filter",
        resourceType: "object_type",
        previewResolved: false,
      }),
    ).toBe(false);
    expect(
      isPermissionRequestProposalReady({
        proposalKind: "property_grants",
        resourceType: "object_type",
        previewResolved: true,
      }),
    ).toBe(true);
  });

  it("keeps base permission requests available while policy preview loads", () => {
    expect(
      isPermissionRequestProposalReady({
        proposalKind: "grant",
        resourceType: "object_type",
        previewResolved: false,
      }),
    ).toBe(true);
  });
});

describe("isPermissionRequestPrefillReady", () => {
  it("waits for pending requests for the current resource before preselecting operations", () => {
    expect(
      isPermissionRequestPrefillReady({
        initialProposalKind: "grant",
        pendingRequestsResourceID: null,
        proposalPreviewResourceID: null,
        requestOpen: true,
        resourceID: "network-1/object-1",
        target: "operations",
      }),
    ).toBe(false);
    expect(
      isPermissionRequestPrefillReady({
        initialProposalKind: "grant",
        pendingRequestsResourceID: "network-1/object-1",
        proposalPreviewResourceID: null,
        requestOpen: true,
        resourceID: "network-1/object-1",
        target: "operations",
      }),
    ).toBe(true);
  });

  it("does not use a previous resource preview to preselect fields", () => {
    expect(
      isPermissionRequestPrefillReady({
        initialProposalKind: "property_grants",
        pendingRequestsResourceID: "network-1/object-2",
        proposalPreviewResourceID: "network-1/object-1",
        requestOpen: true,
        resourceID: "network-1/object-2",
        target: "properties",
      }),
    ).toBe(false);
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

describe("canRequestResourcePermission", () => {
  it("does not expose a request entry when the edition disables permission requests", () => {
    expect(canRequestResourcePermission("object_type", [], false)).toBe(false);
  });
});
