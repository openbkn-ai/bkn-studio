/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

// Object types available for object-level grants, aligned with bkn-safe's type vocabulary in
// section 3 of frontend-object-grants-integration.md. Grants apply to a complete object instance,
// such as a whole Catalog, not individual data resources. Type labels and operation vocabulary
// reuse resource-catalog.
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
  "small_model",
  "large_model",
  "operator",
  "tool_box",
  "mcp",
  "skill",
] as const;

/** Type-level operations hidden by the object-grant UI because they are meaningless on concrete instances. */
export const HIDDEN_INSTANCE_OPS = new Set(["create"]);

export type AuthzObjectType = (typeof AUTHZ_OBJECT_TYPES)[number];

export function isAuthzObjectType(type: string): type is AuthzObjectType {
  return (AUTHZ_OBJECT_TYPES as readonly string[]).includes(type);
}

/** Object-type dropdown options ({value, label}). */
export function authzObjectTypeOptions(): Array<{ label: string; value: string }> {
  return AUTHZ_OBJECT_TYPES.map((type) => ({ label: resourceTypeLabel(type), value: type }));
}
