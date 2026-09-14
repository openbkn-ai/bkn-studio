/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

// Object types available for object-level grants, aligned with bkn-safe's type vocabulary in
// section 3 of frontend-object-grants-integration.md. Model access is a platform
// baseline and is intentionally absent: it cannot be configured as an object grant.
// Type labels and operation vocabulary reuse resource-catalog.
import { resourceTypeLabel } from "@/modules/system-admin/utils/resource-catalog";

export const AUTHZ_OBJECT_TYPES = [
  "catalog",
  "resource",
  "knowledge_network",
  "concept_group",
  "object_type",
  "relation_type",
  "action_type",
  "metric",
  "risk_type",
  "operator",
  "tool_box",
  "mcp",
  "skill",
] as const;

/** Types whose concrete instances can currently be listed and selected for a new object grant. */
export const AUTHZ_OBJECT_PICKER_TYPES = [
  "catalog",
  "resource",
  "knowledge_network",
  "operator",
  "tool_box",
  "mcp",
  "skill",
] as const;

/** Community grants apply only to top-level business resources, never child resources. */
export const COMMUNITY_OBJECT_GRANT_TYPES = [
  "catalog",
  "knowledge_network",
  "operator",
  "tool_box",
  "mcp",
  "skill",
] as const;

/** Filterable grant types for the fine-grained editions. */
export const FINE_GRAINED_OBJECT_FILTER_TYPES = AUTHZ_OBJECT_TYPES;

/** Type-level operations hidden by the object-grant UI because they are meaningless on concrete instances. */
export const HIDDEN_INSTANCE_OPS = new Set(["create"]);

export type AuthzObjectType = (typeof AUTHZ_OBJECT_TYPES)[number];

export function isAuthzObjectType(type: string): type is AuthzObjectType {
  return (AUTHZ_OBJECT_TYPES as readonly string[]).includes(type);
}

export type AuthzObjectPickerType = (typeof AUTHZ_OBJECT_PICKER_TYPES)[number];

export function isAuthzObjectPickerType(type: string): type is AuthzObjectPickerType {
  return (AUTHZ_OBJECT_PICKER_TYPES as readonly string[]).includes(type);
}

export function isCommunityObjectGrantType(type: string) {
  return (COMMUNITY_OBJECT_GRANT_TYPES as readonly string[]).includes(type);
}

/** Object-type dropdown options ({value, label}) for a caller-selected edition catalogue. */
export function authzObjectTypeOptions(
  types: readonly string[] = AUTHZ_OBJECT_TYPES,
): Array<{ label: string; value: string }> {
  return types.map((type) => ({ label: resourceTypeLabel(type), value: type }));
}
