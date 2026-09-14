/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Translates resource grants issued by bkn-safe into permission points declared by Studio modules.
 *
 * The two sides use different naming schemes: bkn-safe emits `<resource_type>:<operation>`
 * (such as `operator:create`), while Studio declares `<module>:<entity>:<action>`
 * (such as `execution-factory:operator:create`). Previously, current-user.ts compared
 * flattened `type:op` values directly with module permissions, which could never match.
 * As a result, every non-super-admin user had an empty permission set on execution-factory
 * pages even when the backend granted `operator:create`.
 *
 * The execution-factory backend exposes only four resource types: operator, tool_box, mcp,
 * and skill (see adp/execution-factory/operator-integration/server/interfaces/logics_auth.go:53-58).
 * The mappings below align with the backend's actual authorization points.
 */

/** Resource types supported by bkn-safe. The backend supports only these four. */
type SafeResourceType = "operator" | "tool_box" | "mcp" | "skill";

const ALL_RESOURCE_TYPES: SafeResourceType[] = ["operator", "tool_box", "mcp", "skill"];

/** Studio actions mapped to bkn-safe operations. Their vocabularies differ and need explicit alignment. */
const ACTION_TO_OPERATION: Record<string, string> = {
  create: "create",
  delete: "delete",
  // Studio calls this debug, while the backend calls it execute.
  debug: "execute",
  // Studio calls this edit, while the backend calls it modify.
  edit: "modify",
  execute: "execute",
  publish: "publish",
  unpublish: "unpublish",
  view: "view",
};

/**
 * Studio entities mapped to bkn-safe resource types.
 *
 * Both capabilities and functions are forms of operators.
 * Tools have no standalone resource type; all tool-level operations are authorized on their
 * parent toolbox, as is consistently done by toolbox_handler.
 */
const ENTITY_TO_RESOURCE_TYPE: Record<string, SafeResourceType> = {
  capability: "operator",
  function: "operator",
  mcp: "mcp",
  operator: "operator",
  skill: "skill",
  tool: "tool_box",
  toolbox: "tool_box",
};

/**
 * Entries that override the default rules. Values list the `type:op` grants that make the
 * permission valid; an empty array means the permission can never be granted.
 *
 * Keys are `<entity>:<action>` without the module prefix, so execution-factory and
 * execution-factory-lab share the same rules.
 */
const OVERRIDES: Record<string, string[]> = {
  // The capability list contains all execution-unit kinds. Any resource view grant opens it;
  // the concrete resource APIs remain responsible for filtering and object-level checks.
  "capability:view": ALL_RESOURCE_TYPES.map((type) => `${type}:view`),
  // Marketplace browsing: the backend uses public_access for all four resource types; there
  // is no dedicated market resource type. bkn-safe also has a catalog resource type, but that
  // refers to the Vega data catalog, not this capability marketplace, and must not be mapped here.
  "catalog:view": ALL_RESOURCE_TYPES.map((type) => `${type}:public_access`),
  // Marketplace installation has no corresponding execution-factory endpoint, so keep the entry
  // hidden until the backend provides one.
  "catalog:install": [],
  // Import/export: export requires read access to any of the four types; import creates the target type.
  "impex:export": ALL_RESOURCE_TYPES.map((type) => `${type}:view`),
  "impex:import": ALL_RESOURCE_TYPES.map((type) => `${type}:create`),
  // Tools have no resource type of their own; write operations always use the parent toolbox's modify grant.
  "tool:create": ["tool_box:modify"],
  "tool:delete": ["tool_box:modify"],
  "tool:edit": ["tool_box:modify"],
};

/**
 * Model-manager resource operations use the bkn-safe catalog vocabulary rather than the
 * Studio module vocabulary. Both large and small model grants open the shared model list.
 */
const MODEL_RESOURCE_PERMISSIONS: Record<string, string[]> = {
  "model-resources:model:view": ["large_model:display", "small_model:display"],
  "model-resources:large-model:view": ["large_model:display"],
  "model-resources:small-model:view": ["small_model:display"],
  "model-resources:model:create": ["large_model:create", "small_model:create"],
  "model-resources:model:edit": ["large_model:modify", "small_model:modify"],
  "model-resources:model:delete": ["large_model:delete", "small_model:delete"],
  "model-resources:quota:view": ["large_model:display", "small_model:display"],
  "model-resources:quota:edit": ["large_model:modify", "small_model:modify"],
  "model-resources:statistics:view": ["large_model:display"],
};

/**
 * Under the compact grant contract, bkn-safe emits global wildcard `*:*` grants (equivalent
 * to super admin) and type-level `${type}:*` grants (all operations for that type). Both
 * wildcards must be considered when checking a `type:op`; otherwise, an account with
 * is_admin=false but a wildcard grant could miss navigation entries.
 */
function safeGrantsCover(safeGrants: Set<string>, type: string, operation: string): boolean {
  return (
    safeGrants.has(`${type}:${operation}`) ||
    safeGrants.has(`${type}:*`) ||
    safeGrants.has("*:*")
  );
}

/**
 * Flattens bkn-safe grant entries into a `type:op` set.
 *
 * This intentionally ignores `resource.id`: the set drives menus, routes, and button guards,
 * answering whether a user can view or modify any resource of this type rather than this exact
 * resource. Therefore, backend-aggregated `instance_operations` (operations granted only on
 * particular instances) must also be included for scope=type; otherwise, users granted access
 * to only a few objects would not see the entry point at all.
 *
 * The trade-off is permissive button visibility: a modify grant on any instance enables edit
 * buttons for every resource of that type, and the backend returns 403 when necessary. Exact
 * per-object visibility requires scoped authorization checks, as model-resources does with
 * getResourceOperations; this set cannot provide that precision.
 */
export function flattenSafeGrants(
  grants:
    | {
        instance_operations?: string[];
        operations?: string[];
        resource?: { id?: string; type?: string };
      }[]
    | undefined,
): Set<string> {
  const flat = new Set<string>();
  for (const entry of grants ?? []) {
    const type = entry.resource?.type;
    if (!type) {
      continue;
    }
    for (const operation of [...(entry.operations ?? []), ...(entry.instance_operations ?? [])]) {
      flat.add(`${type}:${operation}`);
    }
  }
  return flat;
}

/**
 * Module prefixes covered by this mapping.
 *
 * The two execution-factory modules use this common mapping. Knowledge-network maps only its
 * type-level create operation here; instance-level operations must use operations returned by the backend.
 */
const MAPPED_MODULE_PREFIXES = ["execution-factory", "execution-factory-lab"];

/**
 * Knowledge-network creation is type-scoped in bkn-safe. Instance-scoped actions
 * deliberately stay out of this map and must use the backend-provided operations.
 */
const KNOWLEDGE_NETWORK_TYPE_PERMISSIONS: Record<string, string> = {
  "knowledge-network:create": "create",
  "knowledge-network:view": "view_detail",
};

/**
 * Checks whether a Studio permission point is granted by a given bkn-safe grant set.
 *
 * Evaluation order:
 *   1. Direct name match with a bkn-safe `type:op`, preserving existing behavior for every module.
 *   2. Model-resource translation rules.
 *   3. Execution-factory translation rules, where overrides take precedence over generic entity/action mappings.
 *
 * Permissions that cannot be resolved are denied (fail closed): under-grant rather than over-grant.
 */
export function isStudioPermissionGranted(
  studioPermission: string,
  safeGrants: Set<string>,
  _isAdmin: boolean,
): boolean {
  // Keep the public helper signature stable while permissions are being migrated away from
  // is_admin-based authorization. A resource wildcard is handled by fetchCurrentUser instead.
  void _isAdmin;
  // 1. Direct name match. data-catalog's `catalog:view_detail`, for example, uses this path.
  //    Compact wildcards are handled by safeGrantsCover in the mappings below instead of here,
  //    so intentionally blocked permissions such as catalog:install cannot be bypassed.
  if (safeGrants.has(studioPermission)) {
    return true;
  }

  const knowledgeNetworkOperation = KNOWLEDGE_NETWORK_TYPE_PERMISSIONS[studioPermission];
  if (knowledgeNetworkOperation) {
    return safeGrantsCover(safeGrants, "knowledge_network", knowledgeNetworkOperation);
  }

  const modelResourceOperations = MODEL_RESOURCE_PERMISSIONS[studioPermission];
  if (modelResourceOperations) {
    return modelResourceOperations.some((operation) => {
      const [resourceType, resourceOperation] = operation.split(":");
      return safeGrantsCover(safeGrants, resourceType, resourceOperation);
    });
  }

  const segments = studioPermission.split(":");
  if (segments.length < 3 || !MAPPED_MODULE_PREFIXES.includes(segments[0])) {
    return false;
  }
  const suffix = segments.slice(1).join(":");

  // 3. Overrides take precedence. Matching also honors type-level `${type}:*` wildcards.
  const override = OVERRIDES[suffix];
  if (override) {
    return override.some((candidate) => {
      const [candidateType, candidateOp] = candidate.split(":");
      return safeGrantsCover(safeGrants, candidateType, candidateOp);
    });
  }

  const [, entity, action] = segments;
  const resourceType = ENTITY_TO_RESOURCE_TYPE[entity];
  const operation = ACTION_TO_OPERATION[action];
  if (!resourceType || !operation) {
    return false;
  }
  return safeGrantsCover(safeGrants, resourceType, operation);
}

/**
 * Derives the Studio permission points actually held by the current user from bkn-safe grants.
 *
 * knownPermissions contains every permission point declared by module manifests. Derive only
 * within this set to avoid producing permission strings that no module declares.
 */
export function deriveStudioPermissions(
  knownPermissions: readonly string[],
  safeGrants: Set<string>,
  isAdmin: boolean,
): string[] {
  return knownPermissions.filter((permission) =>
    isStudioPermissionGranted(permission, safeGrants, isAdmin),
  );
}
