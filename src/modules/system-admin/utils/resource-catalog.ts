/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import i18n from "@/app/locales/i18n";

export type OperationDef = {
  key: string;
  label: string;
  /** Authoring prerequisite. Effective availability still comes exclusively from bkn-safe. */
  requires: string[];
};

export type ResourceTypeDef = {
  label: string;
  operations: string[];
  type: string;
};

export const WILDCARD = "*";

const OPERATION_FALLBACK_LABELS: Record<string, string> = {
  "*": "All operations",
  authorize: "Authorize",
  create: "Create",
  create_system_agent: "Create system agent",
  data_write: "Write data",
  delete: "Delete",
  display: "View",
  edit: "Edit",
  execute: "Execute",
  grant: "Grant",
  list: "List",
  manage: "Manage",
  manual_exec: "Manual execution",
  members: "Member management",
  mgnt_built_in_agent: "Manage built-in agent",
  modify: "Modify",
  permissions: "Role permission configuration",
  public_access: "Public access",
  publish: "Publish",
  publish_to_be_api_agent: "Publish as API agent",
  publish_to_be_data_flow_agent: "Publish as data flow agent",
  publish_to_be_skill_agent: "Publish as skill agent",
  publish_to_be_web_sdk_agent: "Publish as Web SDK agent",
  query_data: "Query",
  "reset-password": "Reset password",
  resource_manage: "Manage resources",
  revoke: "Revoke",
  run_statistics: "Run statistics",
  run_with_app: "Run with app",
  see_trajectory_analysis: "Trajectory analysis",
  task_manage: "Task management",
  toggle: "Enable/disable",
  unpublish: "Unpublish",
  unpublish_other_user_agent: "Unpublish another user's agent",
  unpublish_other_user_agent_tpl: "Unpublish another user's agent template",
  use: "Use",
  view: "View",
  view_detail: "View",
};

const RESOURCE_FALLBACK_LABELS: Record<string, string> = {
  "admin-audit": "System audit log",
  "admin-authz": "System permission management",
  "admin-dept": "System department management",
  "admin-role": "System role management",
  "admin-user": "System user management",
  agent: "Agent",
  agent_tpl: "Agent template",
  catalog: "Data directory",
  connector_type: "Data connection",
  concept_group: "Concept group",
  data_flow: "Data flow",
  knowledge_network: "Knowledge network",
  large_model: "Large model",
  mcp: "MCP service",
  metric: "Metric",
  object_type: "Object type",
  operator: "Operator",
  resource: "Data resource",
  relation_type: "Relation type",
  risk_type: "Risk type",
  safe_admin: "bkn-safe management API",
  skill: "Skill package",
  small_model: "Small model",
  stream_data_pipeline: "Stream data pipeline",
  tool_box: "API toolset",
  function: "Function set",
};

const CATALOG_CRUD_AUTHZ = [
  "view_detail",
  "create",
  "modify",
  "delete",
  "authorize",
  "task_manage",
];
const CONNECTOR_TYPE_AUTHZ = ["view_detail", "create", "modify", "delete", "authorize"];
// Child resources delegate sharing through the knowledge-network root. They never carry
// `authorize` or `task_manage`; action execution is expressed by `execute`.
const STRUCTURAL_KNOWLEDGE_NETWORK_CHILD_AUTHZ = ["view_detail", "modify", "delete"];
const SCHEMA_KNOWLEDGE_NETWORK_CHILD_AUTHZ = ["view_detail", "query_data", "modify", "delete"];
// An action type describes executable behavior, rather than data that can be
// queried. Keep this vocabulary aligned with bkn-safe's action_type catalog:
// it has no create or query_data operation.
const ACTION_TYPE_AUTHZ = ["view_detail", "modify", "delete", "execute"];
// A data connection owns its tables: creating and building one is judged on the catalog. Resource
// modification and deletion are still explicit resource operations, with bkn-safe falling back to
// the parent catalog's resource_manage permission when they are not granted directly.
const CATALOG_AUTHZ = [...CATALOG_CRUD_AUTHZ, "resource_manage", "query_data", "data_write"];
const RESOURCE_AUTHZ = ["view_detail", "modify", "delete", "query_data", "data_write"];
const PUBLISHABLE = [
  "view",
  "create",
  "modify",
  "delete",
  "execute",
  "authorize",
  "public_access",
  "publish",
  "unpublish",
];

export const RESOURCE_TYPES: ResourceTypeDef[] = [
  resourceType("catalog", CATALOG_AUTHZ),
  resourceType("resource", RESOURCE_AUTHZ),
  resourceType("connector_type", CONNECTOR_TYPE_AUTHZ),
  resourceType("knowledge_network", [
    "view_detail",
    "create",
    "modify",
    "delete",
    "query_data",
    "authorize",
    "execute",
  ]),
  resourceType("concept_group", STRUCTURAL_KNOWLEDGE_NETWORK_CHILD_AUTHZ),
  resourceType("object_type", SCHEMA_KNOWLEDGE_NETWORK_CHILD_AUTHZ),
  resourceType("relation_type", SCHEMA_KNOWLEDGE_NETWORK_CHILD_AUTHZ),
  resourceType("action_type", ACTION_TYPE_AUTHZ),
  resourceType("metric", SCHEMA_KNOWLEDGE_NETWORK_CHILD_AUTHZ),
  resourceType("risk_type", STRUCTURAL_KNOWLEDGE_NETWORK_CHILD_AUTHZ),
  resourceType("small_model", ["create", "display", "modify", "delete", "execute"]),
  resourceType("large_model", ["create", "display", "modify", "delete", "execute"]),
  resourceType("function", PUBLISHABLE),
  resourceType("operator", PUBLISHABLE),
  resourceType("tool_box", PUBLISHABLE),
  resourceType("skill", PUBLISHABLE),
  resourceType("mcp", PUBLISHABLE),
  resourceType("agent", [
    "use",
    "publish",
    "unpublish",
    "unpublish_other_user_agent",
    "publish_to_be_skill_agent",
    "publish_to_be_web_sdk_agent",
    "publish_to_be_api_agent",
    "publish_to_be_data_flow_agent",
    "create_system_agent",
    "mgnt_built_in_agent",
    "see_trajectory_analysis",
  ]),
  resourceType("agent_tpl", ["publish", "unpublish", "unpublish_other_user_agent_tpl"]),
  resourceType("admin-user", ["view", "create", "edit", "delete", "toggle", "reset-password"]),
  resourceType("admin-dept", ["view", "create", "edit", "delete", "members"]),
  resourceType("admin-role", ["view", "create", "edit", "delete", "members", "permissions"]),
  resourceType("admin-authz", ["view", "grant", "revoke"]),
  resourceType("admin-audit", ["view"]),
  resourceType("safe_admin", ["manage"]),
  resourceType("admin-license", ["view", "manage"]),
  resourceType("admin-client", ["manage"]),
  resourceType("admin-apikey", ["manage"]),
];

/**
 * Roles grant type-wide capabilities. Keep unsupported or object-specific resource types out of
 * the role editor without removing them from the canonical catalog: existing grants must remain
 * readable, and object authorization still uses the full resource catalog where applicable.
 */
const ROLE_GRANT_EXCLUDED_RESOURCE_TYPES = new Set([
  "admin-apikey",
  "admin-client",
  "admin-license",
  "agent",
  "agent_tpl",
  "action_type",
  "concept_group",
  "connector_type",
  "large_model",
  "metric",
  "object_type",
  "relation_type",
  "resource",
  "risk_type",
  "safe_admin",
  "small_model",
  // Legacy operators are retired; keep the type only so existing grants still render.
  "operator",
]);

export const ROLE_GRANT_RESOURCE_TYPES = RESOURCE_TYPES.filter(
  (item) => !ROLE_GRANT_EXCLUDED_RESOURCE_TYPES.has(item.type),
);

export function isRoleGrantResourceType(type: string): boolean {
  return !ROLE_GRANT_EXCLUDED_RESOURCE_TYPES.has(type);
}

const byType = new Map(RESOURCE_TYPES.map((item) => [item.type, item]));

function resourceType(type: string, operations: string[]): ResourceTypeDef {
  return {
    label: resourceTypeFallbackLabel(type),
    operations,
    type,
  };
}

export function resourceTypeLabel(type: string): string {
  return i18n.t(`systemAdmin.resourceCatalog.resources.${type}`, {
    defaultValue: resourceTypeFallbackLabel(type),
  });
}

export function operationLabel(type: string, op: string): string {
  const typeLabelKey = `systemAdmin.resourceCatalog.operations.${type}.${op}`;
  if (i18n.exists(typeLabelKey)) {
    return i18n.t(typeLabelKey);
  }
  return i18n.t(`systemAdmin.resourceCatalog.operations.${op}`, {
    defaultValue: operationFallbackLabel(op),
  });
}

export function operationsForType(type: string): OperationDef[] {
  return (byType.get(type)?.operations ?? []).map((op) => ({
    key: op,
    label: operationLabel(type, op),
    requires: requiredOperationsFor(type, op),
  }));
}

export function requiredOperationsFor(type: string, operation: string): string[] {
  return LOCAL_OPERATION_REQUIREMENTS[`${type}:${operation}`] ?? [];
}

// Demo-mode fixture only. Production authoring reads the same explicit edges
// from bkn-safe's /authz/registry endpoint; never infer an edge from a verb.
const LOCAL_OPERATION_REQUIREMENTS: Record<string, string[]> = {
  "catalog:resource_manage": ["view_detail"],
  "connector_type:modify": ["view_detail"],
  "connector_type:delete": ["view_detail"],
  "connector_type:authorize": ["view_detail"],
  "knowledge_network:modify": ["view_detail"],
  "knowledge_network:delete": ["view_detail"],
  "knowledge_network:authorize": ["view_detail"],
  "concept_group:modify": ["view_detail"],
  "concept_group:delete": ["view_detail"],
  "object_type:modify": ["view_detail"],
  "object_type:delete": ["view_detail"],
  "relation_type:modify": ["view_detail"],
  "relation_type:delete": ["view_detail"],
  "action_type:modify": ["view_detail"],
  "action_type:delete": ["view_detail"],
  "metric:modify": ["view_detail"],
  "metric:delete": ["view_detail"],
  "risk_type:modify": ["view_detail"],
  "risk_type:delete": ["view_detail"],
  "function:modify": ["view"],
  "function:delete": ["view"],
  "function:publish": ["view"],
  "function:unpublish": ["view"],
  "function:authorize": ["view"],
  "tool_box:modify": ["view"],
  "tool_box:delete": ["view"],
  "tool_box:publish": ["view"],
  "tool_box:unpublish": ["view"],
  "tool_box:authorize": ["view"],
  "mcp:modify": ["view"],
  "mcp:delete": ["view"],
  "mcp:publish": ["view"],
  "mcp:unpublish": ["view"],
  "mcp:authorize": ["view"],
  "operator:modify": ["view"],
  "operator:delete": ["view"],
  "operator:publish": ["view"],
  "operator:unpublish": ["view"],
  "operator:authorize": ["view"],
  "skill:modify": ["view"],
  "skill:delete": ["view"],
  "skill:publish": ["view"],
  "skill:unpublish": ["view"],
  "skill:authorize": ["view"],
  "small_model:modify": ["display"],
  "small_model:delete": ["display"],
  "large_model:modify": ["display"],
  "large_model:delete": ["display"],
};

function operationFallbackLabel(op: string): string {
  return OPERATION_FALLBACK_LABELS[op] ?? op;
}

function resourceTypeFallbackLabel(type: string): string {
  return RESOURCE_FALLBACK_LABELS[type] ?? type;
}

export function resourceTypeDescription(type: string): string {
  if (type !== "operator" && type !== "tool_box" && type !== "function") return "";
  return i18n.t(`systemAdmin.resourceCatalog.descriptions.${type}`);
}
