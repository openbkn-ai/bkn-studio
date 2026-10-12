/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { getRuntimeConfig } from "@/framework/runtime/config";
import type { CapabilityState } from "@/framework/entitlement/types";

export function canPreviewObjectTypePolicyScope(capability: CapabilityState) {
  return capability === "available";
}

const resourcePermissionOperations: Record<string, readonly string[]> = {
  knowledge_network: ["view_detail", "modify", "delete", "execute", "query_data"],
  catalog: [
    "view_detail",
    "modify",
    "delete",
    "task_manage",
    "resource_manage",
    "query_data",
    "data_write",
  ],
  resource: ["view_detail", "query_data", "data_write", "modify", "delete"],
  tool_box: ["view", "modify", "delete", "publish", "unpublish", "execute"],
  function: ["view", "modify", "delete", "publish", "unpublish", "execute"],
  mcp: ["view", "modify", "delete", "publish", "unpublish", "execute"],
  skill: ["view", "modify", "delete", "publish", "unpublish", "execute"],
  concept_group: ["view_detail", "modify", "delete"],
  object_type: ["view_detail", "modify", "delete", "query_data"],
  relation_type: ["view_detail", "modify", "delete", "query_data"],
  action_type: ["view_detail", "modify", "delete", "execute"],
  metric: ["view_detail", "modify", "delete", "query_data"],
};

export type RequestablePermissionOperation = {
  key: string;
  requires: readonly string[];
};

export type PermissionRequestProposalKind = "grant" | "row_filter" | "property_grants";

export type RowFilterPolicy = {
  conditions: Array<{
    operator: string;
    property_name: string;
    values: Array<string | number | boolean>;
  }>;
  relation: "and" | "or";
};

export type RowFilterProposalPreview = {
  effective_policies?: RowFilterPolicy[];
  effective_policy_present?: boolean;
  policy?: RowFilterPolicy | null;
};

export type PropertyGrantPreviewEntry = {
  level: string;
  property_name: string;
};

export function getEffectiveRowFilterPolicies(preview: RowFilterProposalPreview | undefined) {
  if (preview?.effective_policies?.length) return preview.effective_policies;
  return preview?.policy ? [preview.policy] : [];
}

export function hasEffectiveRowFilter(preview: RowFilterProposalPreview | undefined) {
  return Boolean(
    preview?.effective_policy_present ?? getEffectiveRowFilterPolicies(preview).length,
  );
}

export function getRequestablePropertyGrants(
  entries: PropertyGrantPreviewEntry[],
  propertyNames: string[],
) {
  const explicitEntries = new Map(
    entries
      .filter((entry) => entry.property_name !== "*")
      .map((entry) => [entry.property_name, entry]),
  );
  const wildcardEntry = entries.find((entry) => entry.property_name === "*");

  if (wildcardEntry) {
    for (const propertyName of propertyNames) {
      if (!explicitEntries.has(propertyName)) {
        explicitEntries.set(propertyName, {
          ...wildcardEntry,
          property_name: propertyName,
        });
      }
    }
  }

  return [...explicitEntries.values()].filter(
    (entry) => entry.level !== "full" && entry.level !== "inherit",
  );
}

// Initial values from a deep link may only be applied after the asynchronous
// data for the current dialog resource has returned. Comparing resource IDs
// prevents a reopened dialog from consuming state left by the previous one.
export function isPermissionRequestPrefillReady({
  initialProposalKind,
  pendingRequestsResourceID,
  proposalPreviewResourceID,
  requestOpen,
  resourceID,
  target,
}: {
  initialProposalKind: PermissionRequestProposalKind;
  pendingRequestsResourceID: string | null;
  proposalPreviewResourceID: string | null;
  requestOpen: boolean;
  resourceID: string;
  target: "operations" | "properties";
}) {
  if (!requestOpen) return false;
  if (target === "operations") {
    return initialProposalKind === "grant" && pendingRequestsResourceID === resourceID;
  }
  return initialProposalKind === "property_grants" && proposalPreviewResourceID === resourceID;
}

// Row and property proposals depend on the policy preview to carry the
// current policy/revision. Do not let a deep link submit either proposal while
// that preview is still resolving.
export function isPermissionRequestProposalReady({
  proposalKind,
  resourceType,
  previewResolved,
}: {
  proposalKind: PermissionRequestProposalKind;
  resourceType: string;
  previewResolved: boolean;
}) {
  return resourceType !== "object_type" || proposalKind === "grant" || previewResolved;
}

// Expands a selection only with prerequisites that are still missing. A
// prerequisite absent from requestableOperations is already effective for the
// user, so sending it again would make the whole request conflict at the
// server's live-permission check.
export function togglePermissionRequestOperation(
  current: string[],
  operationKey: string,
  requestableOperations: readonly RequestablePermissionOperation[],
) {
  const operation = requestableOperations.find((candidate) => candidate.key === operationKey);
  if (!operation) return current;

  if (current.includes(operationKey)) {
    const requiredBySelection = requestableOperations.some(
      (candidate) => current.includes(candidate.key) && candidate.requires.includes(operationKey),
    );
    return requiredBySelection
      ? current
      : current.filter((candidateOperation) => candidateOperation !== operationKey);
  }

  const requestableKeys = new Set(requestableOperations.map((candidate) => candidate.key));
  const missingRequirements = operation.requires.filter((requirement) =>
    requestableKeys.has(requirement),
  );
  return [...new Set([...current, ...missingRequirements, operationKey])];
}

export function canRequestResourcePermission(
  resourceType: string,
  operations: string[] | undefined,
  permissionRequestsEnabled = true,
) {
  if (!permissionRequestsEnabled || getRuntimeConfig().currentUser.isSuperAdmin) return false;
  // Object types additionally expose self-service row/property restrictions.
  // Those policies remain meaningful even when every base operation is already
  // effective, so do not hide the only entry point in that situation.
  if (resourceType === "object_type" && Array.isArray(operations)) return true;
  return getMissingResourcePermissionOperations(resourceType, operations).length > 0;
}

export function hasRequestableObjectTypePermission({
  hasPendingRequest,
  hasRowFilter,
  missingOperationCount,
  restrictedPropertyCount,
}: {
  hasPendingRequest: boolean;
  hasRowFilter: boolean;
  missingOperationCount: number;
  restrictedPropertyCount: number;
}) {
  return (
    missingOperationCount > 0 || hasRowFilter || restrictedPropertyCount > 0 || hasPendingRequest
  );
}

export function hasRequestableObjectTypePolicyScope(preview: unknown) {
  const value = preview as {
    property_grants?: { entries?: Array<{ level?: string }> };
    row_filter?: RowFilterProposalPreview;
  };
  const hasRestrictedRowScope = hasEffectiveRowFilter(value.row_filter);
  const hasRestrictedPropertyScope = (value.property_grants?.entries ?? []).some(
    (entry) => entry.level !== "full" && entry.level !== "inherit",
  );
  return hasRestrictedRowScope || hasRestrictedPropertyScope;
}

export function getMissingResourcePermissionOperations(
  resourceType: string,
  operations: string[] | undefined,
) {
  // Do not infer missing permissions when the backend did not return the
  // effective operation set. Otherwise owners could incorrectly see and
  // submit a permission request for resources they already control.
  if (!operations || operations.includes("*") || operations.includes("full_business_access")) {
    return [];
  }

  return (resourcePermissionOperations[resourceType] ?? []).filter(
    (operation) => !operations.includes(operation),
  );
}
