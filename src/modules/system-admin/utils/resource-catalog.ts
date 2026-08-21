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
  delete: "Delete",
  display: "Display",
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
  query_data: "Query data",
  "reset-password": "Reset password",
  resource_manage: "Manage tables",
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
  view_detail: "View details",
};

const RESOURCE_FALLBACK_LABELS: Record<string, string> = {
  "admin-audit": "System audit log",
  "admin-authz": "System permission management",
  "admin-dept": "System department management",
  "admin-role": "System role management",
  "admin-user": "System user management",
  agent: "Agent",
  agent_tpl: "Agent template",
  catalog: "Data connection / Catalog",
  connector_type: "Connector type",
  data_flow: "Data flow",
  knowledge_network: "Knowledge network",
  large_model: "Large model",
  mcp: "MCP",
  operator: "Operator",
  resource: "Data resource",
  safe_admin: "bkn-safe management API",
  skill: "Skill",
  small_model: "Small model",
  stream_data_pipeline: "Stream data pipeline",
  tool_box: "Toolbox",
};

const CRUD_AUTHZ = ["view_detail", "create", "modify", "delete", "authorize", "task_manage"];
// A data connection owns its tables: creating, editing and building one is judged on the catalog,
// not on the table (openbkn-ai/bkn-foundry#986). The table itself declares only these two. Both
// lists match the operations bkn-safe actually stores on these types.
const CATALOG_AUTHZ = [...CRUD_AUTHZ, "resource_manage", "query_data"];
const RESOURCE_AUTHZ = ["view_detail", "query_data"];
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
  resourceType("connector_type", CRUD_AUTHZ),
  resourceType("knowledge_network", [
    "view_detail",
    "create",
    "modify",
    "delete",
    "query_data",
    "authorize",
    "task_manage",
  ]),
  resourceType("stream_data_pipeline", ["view_detail", "create", "modify", "delete", "authorize"]),
  resourceType("data_flow", [
    "list",
    "view",
    "create",
    "modify",
    "delete",
    "manual_exec",
    "run_statistics",
    "run_with_app",
    "display",
  ]),
  resourceType("small_model", ["display", "create", "modify", "delete", "execute"]),
  resourceType("large_model", ["display", "create", "modify", "delete", "execute"]),
  resourceType("operator", PUBLISHABLE),
  resourceType("tool_box", PUBLISHABLE),
  resourceType("skill", PUBLISHABLE),
  resourceType("mcp", PUBLISHABLE),
  resourceType("agent", [
    "use",
    "publish",
    "unpublish",
    "unpublish_other_user_agent",
    "create_system_agent",
    "mgnt_built_in_agent",
    "see_trajectory_analysis",
    "publish_to_be_api_agent",
    "publish_to_be_data_flow_agent",
    "publish_to_be_skill_agent",
    "publish_to_be_web_sdk_agent",
  ]),
  resourceType("agent_tpl", ["publish", "unpublish", "unpublish_other_user_agent_tpl"]),
  resourceType("admin-user", ["create", "edit", "delete", "toggle", "reset-password"]),
  resourceType("admin-dept", ["create", "edit", "delete", "members"]),
  resourceType("admin-role", ["create", "edit", "delete", "members", "permissions"]),
  resourceType("admin-authz", ["grant", "revoke"]),
  resourceType("admin-audit", ["view"]),
  resourceType("safe_admin", ["manage"]),
];

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

export function operationLabel(_type: string, op: string): string {
  return i18n.t(`systemAdmin.resourceCatalog.operations.${op}`, {
    defaultValue: operationFallbackLabel(op),
  });
}

export function operationsForType(type: string): OperationDef[] {
  return (byType.get(type)?.operations ?? []).map((op) => ({
    key: op,
    label: operationLabel(type, op),
  }));
}

function operationFallbackLabel(op: string): string {
  return OPERATION_FALLBACK_LABELS[op] ?? op;
}

function resourceTypeFallbackLabel(type: string): string {
  return RESOURCE_FALLBACK_LABELS[type] ?? type;
}
