/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import {
  listDomainObjects,
  resolveGrantNames,
} from "@/modules/system-admin/services/authz-objects.service";
import type { AdminUser } from "@/modules/system-admin/types/admin";
import type {
  AuthorizableObject,
  AuthzSummary,
  EffectiveDecision,
  EnterpriseObjectGrant,
  GrantRecord,
  ObjectGrant,
  ObjectGrantInput,
  ObjectGrantListResult,
  ObjectGrantQuery,
} from "@/modules/system-admin/types/authz";

/**
 * Object-level authorization service for bkn-safe `/api/safe/v1/admin/object-grants`.
 * Uses frontend mock data by default; `VITE_USE_MOCK=false` calls the real backend.
 * See bkn-foundry/bkn-safe/docs/frontend-object-grants-integration.md.
 *
 * - Grant model: {accessor_id, resource:{type,id}, operations[]}; grantees are users.
 * - POST replaces the whole operation set; operations must be non-empty and resource.id concrete.
 * - DELETE revokes one user's grant on one resource.
 * - bkn-safe does not store resource names; real mode resolves them from domain services.
 */
const useMock = import.meta.env.VITE_USE_MOCK !== "false";

const ADMIN = "/safe/v1/admin";

const wait = async <T,>(value: T) =>
  new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(value), 160);
  });

// ---- mock store -------------------------------------------------------------

// Demo authorizable objects. Real mode loads them from domain services.
const authzObjects: AuthorizableObject[] = [
  { type: "knowledge_network", id: "kn-customer-360", name: "Customer 360 Knowledge Network", sub: "customer" },
  { type: "knowledge_network", id: "kn-finance-risk", name: "Financial Risk Knowledge Network", sub: "finance" },
  { type: "catalog", id: "cat-customer-mysql", name: "Customer Master Data - MySQL", sub: "mysql" },
  { type: "catalog", id: "cat-events-kafka", name: "Behavior Events - Kafka", sub: "kafka" },
  { type: "small_model", id: "bge-m3", name: "BGE-M3", sub: "bge · embedding" },
  { type: "large_model", id: "qwen3-72b", name: "Qwen3-72B-Instruct", sub: "qwen · chat" },
  { type: "operator", id: "op-text-clean", name: "Text Cleaning Operator", sub: "transform" },
  { type: "tool_box", id: "tb-web-search", name: "Web Search Toolbox", sub: "toolbox" },
  { type: "mcp", id: "mcp-filesystem", name: "Filesystem MCP", sub: "mcp" },
  { type: "skill", id: "sk-sql-gen", name: "SQL Generation Skill", sub: "skill" },
];

const objMeta = (type: string, id: string) =>
  authzObjects.find((item) => item.type === type && item.id === id);

const seed = (
  objType: string,
  objId: string,
  accessorId: string,
  operations: string[],
): ObjectGrant => {
  const meta = objMeta(objType, objId);
  const sourceGrants = operations.map((operation, index): GrantRecord => ({
    active: true,
    accessorId,
    authoritySource: "admin_authz",
    effect: "allow",
    grantId: `mock-${objType}-${objId}-${accessorId}-${index}`,
    inherited: false,
    operation,
    policySource: "professional_rule",
  }));
  return {
    accessorId,
    deniedOperations: [],
    effectiveDecisions: operations.map((operation): EffectiveDecision => ({
      basis: "direct",
      decision: "allow",
      operation,
      requires: [],
    })),
    grants: sourceGrants,
    objType,
    objId,
    objName: meta?.name ?? objId,
    objSub: meta?.sub,
    operations,
  };
};

let grants: ObjectGrant[] = [
  seed("knowledge_network", "kn-customer-360", "u-li", ["view_detail", "modify", "query_data"]),
  seed("knowledge_network", "kn-finance-risk", "u-li", ["view_detail"]),
  seed("catalog", "cat-customer-mysql", "u-li", ["view_detail", "modify", "task_manage"]),
  seed("catalog", "cat-customer-mysql", "u-chen", ["view_detail"]),
  seed("small_model", "bge-m3", "u-chen", ["display", "execute"]),
  seed("large_model", "qwen3-72b", "u-chen", ["display", "execute"]),
  seed("operator", "op-text-clean", "u-wang", ["view", "execute"]),
  seed("tool_box", "tb-web-search", "u-wang", ["view", "execute", "publish"]),
  seed("mcp", "mcp-filesystem", "u-wang", ["view", "execute"]),
  seed("skill", "sk-sql-gen", "u-chen", ["view", "execute"]),
];

const sameTarget = (
  grant: ObjectGrant,
  input: Pick<ObjectGrantInput, "accessorId" | "objType" | "objId">,
) => grant.accessorId === input.accessorId && grant.objType === input.objType && grant.objId === input.objId;

const clone = (grant: ObjectGrant): ObjectGrant => ({
  ...grant,
  deniedOperations: [...(grant.deniedOperations ?? [])],
  effectiveDecisions: (grant.effectiveDecisions ?? []).map((decision) => ({
    ...decision,
    inheritedFrom: decision.inheritedFrom
      ? { ...decision.inheritedFrom, resource: { ...decision.inheritedFrom.resource } }
      : undefined,
    requires: [...decision.requires],
  })),
  grants: (grant.grants ?? []).map((record) => ({ ...record })),
  operations: [...grant.operations],
});

// ---- reads ------------------------------------------------------------------

function filterMockGrants(query: ObjectGrantQuery): ObjectGrant[] {
  const search = query.search?.trim().toLowerCase();
  return grants.filter((grant) => {
    if (query.accessorId && grant.accessorId !== query.accessorId) {
      return false;
    }
    if (query.resourceType && grant.objType !== query.resourceType) {
      return false;
    }
    if (query.resourceId && grant.objId !== query.resourceId) {
      return false;
    }
    if (search) {
      const haystack = [grant.objName, grant.objSub, grant.objId, grant.objType, grant.accessorId]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }
    return true;
  });
}

export async function listObjectGrantsPage(
  query: ObjectGrantQuery = {},
  options: { resolveNames?: boolean } = {},
): Promise<ObjectGrantListResult> {
  if (useMock) {
    const filtered = filterMockGrants(query).map(clone);
    const total = filtered.length;
    const summary = summarizeGrants(filtered);
    const offset = query.offset ?? 0;
    const limit = query.limit;
    const page =
      limit === undefined ? filtered : filtered.slice(offset, offset + Math.max(limit, 0));
    return {
      grants: page,
      total,
      summary: query.includeSummary ? summary : undefined,
    };
  }

  const params = new URLSearchParams();
  if (query.accessorId) {
    params.set("accessor_id", query.accessorId);
  }
  if (query.resourceType) {
    params.set("resource_type", query.resourceType);
  }
  if (query.resourceId) {
    params.set("resource_id", query.resourceId);
  }
  if (query.search) {
    params.set("search", query.search);
  }
  if (query.offset !== undefined) {
    params.set("offset", String(query.offset));
  }
  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }
  if (query.includeSummary) {
    params.set("include_summary", "true");
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await http.get<{
    entries?: BackendEntry[];
    total?: number;
    summary?: AuthzSummary;
  }>(`${ADMIN}/object-grants${suffix}`);
  const mapped = (response.data.entries ?? []).map(mapObjectGrantEntry);
  // Resolve names by default for drawers. List pages can render ids first and hydrate names later.
  const grants = options.resolveNames === false ? mapped : await resolveGrantNames(mapped);
  return {
    grants,
    total: response.data.total ?? grants.length,
    summary: response.data.summary,
  };
}

export async function listObjectGrants(query: ObjectGrantQuery = {}): Promise<ObjectGrant[]> {
  const { grants: grantList } = await listObjectGrantsPage(query);
  return grantList;
}

/** One grouped row: an object group or grantee group aggregate. */
export type AuthzGroup = {
  objType?: string;
  objId?: string;
  objName?: string;
  accessorId?: string;
  /** Object mode counts grantees; grantee mode counts objects. */
  count: number;
  /** Merged operation set for this group. */
  operations: string[];
};

/**
 * Data source for grouped views. The backend aggregates by object or grantee and
 * paginates results, so the frontend no longer loads all grants for client grouping.
 */
export async function listObjectGroups(
  groupBy: "object" | "grantee",
  query: { offset?: number; limit?: number; search?: string; resourceType?: string } = {},
): Promise<{ groups: AuthzGroup[]; total: number }> {
  if (useMock) {
    const filtered = filterMockGrants({ search: query.search, resourceType: query.resourceType });
    const map = new Map<string, AuthzGroup>();
    for (const grant of filtered) {
      const key = groupBy === "object" ? `${grant.objType}::${grant.objId}` : grant.accessorId;
      const row =
        map.get(key) ??
        (groupBy === "object"
          ? { objType: grant.objType, objId: grant.objId, objName: grant.objName, count: 0, operations: [] }
          : { accessorId: grant.accessorId, count: 0, operations: [] });
      row.count += 1;
      row.operations = [...new Set([...row.operations, ...grant.operations])];
      map.set(key, row);
    }
    const all = [...map.values()];
    const offset = query.offset ?? 0;
    const limit = query.limit;
    const page = limit === undefined ? all : all.slice(offset, offset + Math.max(limit, 0));
    return wait({ groups: page, total: all.length });
  }

  const params = new URLSearchParams();
  params.set("group_by", groupBy);
  if (query.resourceType) {
    params.set("resource_type", query.resourceType);
  }
  if (query.search) {
    params.set("search", query.search);
  }
  if (query.offset !== undefined) {
    params.set("offset", String(query.offset));
  }
  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }

  const response = await http.get<{
    groups?: {
      object?: { type?: string; id?: string; name?: string };
      accessor_id?: string;
      grantee_count?: number;
      object_count?: number;
      operations?: string[];
    }[];
    total?: number;
  }>(`${ADMIN}/object-grants?${params.toString()}`);

  const groups: AuthzGroup[] = (response.data.groups ?? []).map((raw) =>
    groupBy === "object"
      ? {
          objType: raw.object?.type ?? "",
          objId: raw.object?.id ?? "",
          objName: raw.object?.name || raw.object?.id || "",
          count: raw.grantee_count ?? 0,
          operations: raw.operations ?? [],
        }
      : {
          accessorId: raw.accessor_id ?? "",
          count: raw.object_count ?? 0,
          operations: raw.operations ?? [],
        },
  );
  return { groups, total: response.data.total ?? groups.length };
}

export async function listAuthorizableObjects(objType?: string): Promise<AuthorizableObject[]> {
  if (useMock) {
    return wait(authzObjects.filter((item) => !objType || item.type === objType).map((item) => ({ ...item })));
  }
  return listDomainObjects(objType);
}

export function summarizeGrants(list: ObjectGrant[]): AuthzSummary {
  const objects = new Set(list.map((g) => `${g.objType}:${g.objId}`));
  const grantees = new Set(list.map((g) => g.accessorId));
  return { grants: list.length, objects: objects.size, grantees: grantees.size };
}

// ---- writes -----------------------------------------------------------------

/** Creates independent source records. The mock keeps identical active sources idempotent. */
export async function upsertObjectGrant(input: ObjectGrantInput): Promise<void> {
  if (useMock) {
    const existing = grants.find((g) => sameTarget(g, input));
    if ("bundle" in input) {
      const bundleGrant = existing ?? seed(input.objType, input.objId, input.accessorId, []);
      bundleGrant.bundle = input.bundle;
      if (!(bundleGrant.grants ?? []).some((record) => record.policySource === "community_bundle")) {
        bundleGrant.grants = [
          ...(bundleGrant.grants ?? []),
          {
            active: true,
            accessorId: input.accessorId,
            authoritySource: "admin_authz",
            effect: "allow",
            grantId: `mock-bundle-${Date.now()}`,
            inherited: false,
            operation: input.bundle,
            policySource: "community_bundle",
          },
        ];
      }
      bundleGrant.objName = input.objName;
      bundleGrant.objSub = input.objSub;
      if (!existing) {
        grants = [...grants, bundleGrant];
      }
      await wait(undefined);
      return;
    }

    if (!input.operations.length) {
      return;
    }
    const effect = input.effect ?? "allow";
    const target = existing ?? seed(input.objType, input.objId, input.accessorId, []);
    const existingOperations = new Set((target.grants ?? [])
      .filter(
        (record) =>
          record.active &&
          !record.inherited &&
          record.effect === effect &&
          record.policySource === "professional_rule",
      )
      .map((record) => record.operation));
    const created = input.operations
      .filter((operation) => !existingOperations.has(operation))
      .map((operation, index): GrantRecord => ({
      active: true,
      accessorId: input.accessorId,
      authoritySource: "admin_authz",
      effect,
      grantId: `mock-${Date.now()}-${index}`,
      inherited: false,
      operation,
      policySource: "professional_rule",
      }));
    target.grants = [...(target.grants ?? []), ...created];
    target.operations = [...new Set(target.grants.filter((record) => record.active && record.effect === "allow").map((record) => record.operation))];
    target.deniedOperations = [...new Set(target.grants.filter((record) => record.active && record.effect === "deny").map((record) => record.operation))];
    target.effectiveDecisions = [...new Set([...target.operations, ...target.deniedOperations])].map(
      (operation): EffectiveDecision => ({
        basis: "direct",
        decision: (target.deniedOperations ?? []).includes(operation) ? "deny" : "allow",
        operation,
        requires: [],
      }),
    );
    target.objName = input.objName;
    target.objSub = input.objSub;
    if (!existing) {
      grants = [...grants, target];
    }
    await wait(undefined);
    return;
  }
  const payload = "bundle" in input
    ? {
        accessor_id: input.accessorId,
        bundle: input.bundle,
        resource: { type: input.objType, id: input.objId },
      }
    : {
        accessor_id: input.accessorId,
        effect: input.effect ?? "allow",
        operations: input.operations,
        resource: { type: input.objType, id: input.objId },
      };
  await http.post(`${ADMIN}/object-grants`, payload);
}

/** Revokes exactly one source record. Other records for the same tuple remain untouched. */
export async function revokeObjectGrant(grantId: string): Promise<void> {
  if (useMock) {
    grants = grants
      .map((grant) => {
        if (!(grant.grants ?? []).some((record) => record.grantId === grantId)) {
          return grant;
        }
        const sourceRecords = (grant.grants ?? []).filter((record) => record.grantId !== grantId);
        if (!sourceRecords.length && !grant.bundle) {
          return null;
        }
        const operations = [...new Set(sourceRecords.filter((record) => record.active && record.effect === "allow").map((record) => record.operation))];
        const deniedOperations = [...new Set(sourceRecords.filter((record) => record.active && record.effect === "deny").map((record) => record.operation))];
        return {
          ...grant,
          deniedOperations,
          effectiveDecisions: [...new Set([...operations, ...deniedOperations])].map(
            (operation): EffectiveDecision => ({
              basis: "direct",
              decision: deniedOperations.includes(operation) ? "deny" : "allow",
              operation,
              requires: [],
            }),
          ),
          grants: sourceRecords,
          operations,
        };
      })
      .filter((grant): grant is ObjectGrant => grant !== null);
    await wait(undefined);
    return;
  }
  await http.request({
    url: `${ADMIN}/object-grants`,
    method: "DELETE",
    data: { grant_id: grantId },
  });
}

/** Community bundle revocation also uses its server-issued grant id. */
export async function revokeCommunityBundle(grantId: string): Promise<void> {
  await revokeObjectGrant(grantId);
}

// ---- backend mapper (real path) --------------------------------------------

type BackendEntry = {
  accessor_id?: string;
  bundle?: "full_business_access";
  denied_operations?: string[];
  effective_decisions?: BackendEffectiveDecision[];
  grants?: BackendGrantRecord[];
  operations?: string[];
  resource?: { id?: string; type?: string };
};

type BackendGrantRecord = {
  active?: boolean;
  accessor_id?: string;
  authority_source?: GrantRecord["authoritySource"];
  effect?: GrantRecord["effect"];
  grant_id?: string;
  inherited?: boolean;
  operation?: string;
  policy_source?: GrantRecord["policySource"];
};

type BackendEffectiveDecision = {
  basis?: EffectiveDecision["basis"];
  decision?: EffectiveDecision["decision"];
  denied_requirement?: string;
  inherited_from?: { operation?: string; resource?: { id?: string; type?: string } };
  operation?: string;
  requirement_basis?: EffectiveDecision["requirementBasis"];
  requires?: string[];
};

function mapGrantRecord(item: BackendGrantRecord, accessorId: string): GrantRecord {
  return {
    active: item.active === true,
    accessorId: item.accessor_id ?? accessorId,
    authoritySource: item.authority_source ?? "system",
    effect: item.effect ?? "allow",
    grantId: item.grant_id ?? "",
    inherited: item.inherited === true,
    operation: item.operation ?? "",
    policySource: item.policy_source ?? "legacy",
  };
}

function mapEffectiveDecision(item: BackendEffectiveDecision): EffectiveDecision {
  const inheritedResource = item.inherited_from?.resource;
  return {
    basis: item.basis ?? "default",
    decision: item.decision ?? "deny",
    deniedRequirement: item.denied_requirement,
    inheritedFrom: item.inherited_from
      ? {
          operation: item.inherited_from.operation ?? "",
          resource: {
            id: inheritedResource?.id ?? "",
            type: inheritedResource?.type ?? "",
          },
        }
      : undefined,
    operation: item.operation ?? "",
    requirementBasis: item.requirement_basis,
    requires: item.requires ?? [],
  };
}

export function mapObjectGrantEntry(item: BackendEntry): ObjectGrant {
  const objId = item.resource?.id ?? "";
  const accessorId = item.accessor_id ?? "";
  return {
    accessorId,
    bundle: item.bundle,
    deniedOperations: item.denied_operations ?? [],
    effectiveDecisions: (item.effective_decisions ?? []).map(mapEffectiveDecision),
    grants: (item.grants ?? []).map((record) => mapGrantRecord(record, accessorId)),
    objType: item.resource?.type ?? "",
    objId,
    // The backend does not return resource names; callers resolve them in real mode.
    objName: objId,
    operations: item.operations ?? [],
  };
}

// ---- object-scoped self-service ---------------------------------------------

/**
 * Reads and writes for the grants on ONE object, through bkn-safe's self-service surface
 * (`/safe/v1/me/...`) rather than the admin one.
 *
 * The admin endpoints sit behind a platform-administrator gate that a business role never passes,
 * so the person who created a knowledge network could not see or change who else could reach it.
 * The self-service endpoints answer to either an administrator or the holder of `authorize` on the
 * very object named in the request — the row the domain services write to the creator — so one code
 * path serves both audiences and the admin case keeps working unchanged.
 *
 * Scoped to a single object by construction. "Every grant on the platform" stays on the admin
 * listing above.
 */

type BackendMeGrantEntry = {
  accessor_account?: string;
  accessor_id?: string;
  accessor_name?: string;
} & BackendEntry;

/** Grantees of one object, with accounts resolved server-side (the user directory is admin-only). */
export async function listObjectGrantsForObject(
  objType: string,
  objId: string,
): Promise<{ accounts: AdminUser[]; grants: ObjectGrant[] }> {
  if (useMock) {
    return { accounts: [], grants: await listObjectGrants({ resourceType: objType, resourceId: objId }) };
  }
  const response = await http.get<{ entries?: BackendMeGrantEntry[] }>("/safe/v1/me/object-grants", {
    params: { resource_id: objId, resource_type: objType },
  });
  const entries = (response.data.entries ?? []).filter((entry) => entry.accessor_id);
  return {
    // Shaped as AdminUser only so the shared display cache can be primed from it. The fields this
    // surface cannot know (roles, departments, enabled) stay empty rather than being invented.
    accounts: entries
      .filter((entry) => entry.accessor_account)
      .map((entry) => ({
        account: entry.accessor_account ?? "",
        accountType: "",
        email: "",
        enabled: true,
        id: entry.accessor_id ?? "",
        name: entry.accessor_name || entry.accessor_account || "",
        roleIds: [],
        telephone: "",
      })),
    grants: entries.map((entry) => mapObjectGrantEntry({
      ...entry,
      resource: entry.resource ?? { id: objId, type: objType },
    })),
  };
}

/** Replaces one grantee's operation set on this object. An empty set revokes, as with the admin write. */
export async function upsertObjectGrantForObject(input: ObjectGrantInput): Promise<void> {
  if (useMock) {
    await upsertObjectGrant(input);
    return;
  }
  const payload = "bundle" in input
    ? {
        accessor_id: input.accessorId,
        bundle: input.bundle,
        resource: { id: input.objId, type: input.objType },
      }
    : {
        accessor_id: input.accessorId,
        effect: input.effect ?? "allow",
        operations: input.operations,
        resource: { id: input.objId, type: input.objType },
      };
  await http.post("/safe/v1/me/object-grants", payload);
}

/** Removes one grantee's access to this object entirely. Idempotent server-side. */
export async function revokeObjectGrantForObject(
  grantId: string,
): Promise<void> {
  if (useMock) {
    await revokeObjectGrant(grantId);
    return;
  }
  await http.delete("/safe/v1/me/object-grants", {
    data: { grant_id: grantId },
  });
}

/**
 * Accounts this object can be shared with.
 *
 * Scoped to the object rather than to the platform: the user directory is admin-only, and bkn-safe
 * opens this lookup exactly to callers who may already authorize the object they name.
 */
export async function listGrantableUsersForObject(
  objType: string,
  objId: string,
  search: string,
): Promise<AdminUser[]> {
  if (useMock) {
    return [];
  }
  const response = await http.get<{ users?: { account?: string; id?: string; name?: string }[] }>(
    "/safe/v1/me/grantable-users",
    { params: { resource_id: objId, resource_type: objType, search: search.trim() } },
  );
  return (response.data.users ?? [])
    .filter((user) => user.id)
    .map((user) => ({
      account: user.account ?? "",
      accountType: "",
      email: "",
      enabled: true,
      id: user.id ?? "",
      name: user.name || user.account || "",
      roleIds: [],
      telephone: "",
    }));
}

/** Read-only Enterprise compatibility inventory. Runtime eligibility is supplied by the server. */
export async function listEnterpriseObjectGrants(query: {
  accessorId?: string;
  resourceId?: string;
  resourceType?: string;
} = {}): Promise<EnterpriseObjectGrant[]> {
  if (useMock) {
    return wait([]);
  }
  const response = await http.get<{ entries?: Array<{
    activation_state?: EnterpriseObjectGrant["activationState"];
    accessor_id?: string;
    classification?: string;
    effect?: EnterpriseObjectGrant["effect"];
    expires_at?: string;
    grant_id?: string;
    inactive_reason?: string;
    operation?: string;
    resource_id?: string;
    resource_type?: string;
    rule_id?: string;
    runtime_eligible?: boolean;
    subject_type?: EnterpriseObjectGrant["subjectType"];
  }> }>(`${ADMIN}/enterprise-object-grants`, {
    params: {
      accessor_id: query.accessorId,
      resource_id: query.resourceId,
      resource_type: query.resourceType,
    },
  });
  return (response.data.entries ?? []).map((entry) => ({
    activationState: entry.activation_state ?? "invalid",
    accessorId: entry.accessor_id ?? "",
    classification: entry.classification ?? "",
    effect: entry.effect ?? "deny",
    expiresAt: entry.expires_at,
    grantId: entry.grant_id ?? "",
    inactiveReason: entry.inactive_reason,
    operation: entry.operation ?? "",
    resourceId: entry.resource_id ?? "",
    resourceType: entry.resource_type ?? "",
    ruleId: entry.rule_id ?? "",
    runtimeEligible: entry.runtime_eligible === true,
    subjectType: entry.subject_type ?? "unknown",
  }));
}
