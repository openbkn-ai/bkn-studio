/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import i18n from "@/app/locales/i18n";
import { childDepartments, computeSubtreeMemberCounts } from "@/modules/system-admin/utils/admin-helpers";
import type {
  AdminDepartment,
  AdminRole,
  AdminUser,
  AuditLog,
  AuditLogQuery,
  CreateUserInput,
  DepartmentInput,
  ResourceGrant,
  RoleInput,
  UpdateUserInput,
  UserListQuery,
} from "@/modules/system-admin/types/admin";

/**
 * System admin service for the bkn-safe token-gated admin API.
 * Uses frontend mock data by default; VITE_USE_MOCK=false calls the real backend.
 *
 * Backend write gaps are intentionally omitted from write paths until support lands.
 */
const useMock = import.meta.env.VITE_USE_MOCK !== "false";

const ADMIN = "/safe/v1/admin";

const wait = async <T,>(value: T) =>
  new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(value), 160);
  });

const now = () => Date.now();
const daysAgo = (days: number) => now() - days * 86_400_000;
const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const grant = (type: string, id: string, operations: string[]): ResourceGrant => ({
  resource: { type, id },
  operations,
});

// ---- mock store -------------------------------------------------------------

let departments: AdminDepartment[] = [
  { id: "dep-root", parentId: null, name: "BKN Platform", type: "org", code: "BKN" },
  { id: "dep-data", parentId: "dep-root", name: "Data Intelligence", type: "dept" },
  { id: "dep-ke", parentId: "dep-data", name: "Knowledge Engineering", type: "dept" },
  { id: "dep-gov", parentId: "dep-data", name: "Data Governance", type: "dept" },
  { id: "dep-rd", parentId: "dep-root", name: "Platform Engineering", type: "dept" },
  { id: "dep-cs", parentId: "dep-root", name: "Customer Success", type: "dept" },
];

let users: AdminUser[] = [
  { id: "u-admin", account: "local-admin", name: "Local Admin", email: "admin@bkn.local", telephone: "", enabled: true, accountType: "local", builtin: true, roleIds: [], departmentIds: ["dep-root"], updatedAt: daysAgo(2) },
  { id: "u-chen", account: "chen.yanqiu", name: "Yanqiu Chen", email: "chen.yanqiu@bkn.local", telephone: "", enabled: true, accountType: "local", roleIds: [], departmentIds: ["dep-ke"], updatedAt: daysAgo(4) },
  { id: "u-li", account: "li.mubai", name: "Mubai Li", email: "li.mubai@bkn.local", telephone: "", enabled: true, accountType: "local", roleIds: [], departmentIds: ["dep-gov"], updatedAt: daysAgo(9) },
  { id: "u-wang", account: "wang.xiaoou", name: "Xiaoou Wang", email: "wang.xiaoou@bkn.local", telephone: "", enabled: true, accountType: "local", roleIds: [], departmentIds: ["dep-rd"], updatedAt: daysAgo(1) },
  { id: "u-zhao", account: "zhao.qinglan", name: "Qinglan Zhao", email: "zhao.qinglan@bkn.local", telephone: "", enabled: false, accountType: "local", roleIds: [], departmentIds: ["dep-cs"], updatedAt: daysAgo(15) },
];

const auditLog: AuditLog[] = [
  { id: "al-1", actorId: "u-admin", method: "POST", resource: "users", action: "users", targetId: "u-chen", status: 201, clientIp: "127.0.0.1", createdAt: new Date(daysAgo(4)).toISOString() },
  { id: "al-2", actorId: "u-admin", method: "POST", resource: "roles", action: "roles.permissions", targetId: "role-network-builder", status: 204, clientIp: "127.0.0.1", createdAt: new Date(daysAgo(3)).toISOString() },
  { id: "al-3", actorId: "u-admin", method: "DELETE", resource: "users", action: "users", targetId: "u-ghost", status: 404, clientIp: "127.0.0.1", createdAt: new Date(daysAgo(2)).toISOString() },
  { id: "al-4", actorId: "u-li", method: "POST", resource: "departments", action: "departments.members", targetId: "dep-gov", status: 204, clientIp: "127.0.0.2", createdAt: new Date(daysAgo(1)).toISOString() },
  { id: "al-5", actorId: "u-admin", method: "POST", resource: "role-bindings", action: "role-bindings", targetId: "", status: 204, clientIp: "127.0.0.1", createdAt: new Date(daysAgo(1)).toISOString() },
];

let roles: AdminRole[] = [
  {
    id: "role-super-admin", name: "super_admin", description: "Built-in hidden and controlled role with full platform permissions.",
    builtin: true, source: "system",
    permissions: [grant("*", "*", ["*"])],
    accessorIds: ["u-admin"], updatedAt: daysAgo(30),
  },
  {
    id: "role-admin", name: "admin", description: "System administrator for operations, users, and departments.",
    builtin: true, source: "system",
    permissions: [
      grant("admin-user", "*", ["create", "edit", "delete", "toggle", "reset-password"]),
      grant("admin-dept", "*", ["create", "edit", "delete", "members"]),
    ],
    accessorIds: [], updatedAt: daysAgo(30),
  },
  {
    id: "role-security", name: "security", description: "Security administrator for roles, authorization, and account security.",
    builtin: true, source: "system",
    permissions: [
      grant("admin-role", "*", ["create", "edit", "delete", "members"]),
      grant("admin-authz", "*", ["grant", "revoke"]),
      grant("admin-user", "*", ["edit", "toggle", "reset-password"]),
    ],
    accessorIds: [], updatedAt: daysAgo(30),
  },
  {
    id: "role-audit", name: "audit", description: "Audit administrator for audit logs, permission review, and admin behavior supervision.",
    builtin: true, source: "system",
    permissions: [
      grant("admin-audit", "*", ["view"]),
    ],
    accessorIds: [], updatedAt: daysAgo(30),
  },
  {
    id: "role-network-builder", name: "network_builder", description: "Business network builder for data, knowledge, models, and execution factory assets.",
    builtin: true, source: "business",
    permissions: [
      grant("catalog", "*", ["view", "create", "modify", "delete", "authorize", "task_manage"]),
      grant("resource", "*", ["view", "create", "modify", "delete", "authorize", "task_manage"]),
      grant("knowledge_network", "*", ["view_detail", "create", "modify", "delete", "data_query", "authorize", "task_manage"]),
      grant("small_model", "*", ["display", "create", "modify", "execute"]),
      grant("large_model", "*", ["display", "create", "modify", "execute"]),
      grant("operator", "*", ["view", "create", "modify", "execute", "public_access", "publish", "unpublish"]),
      grant("tool_box", "*", ["view", "create", "modify", "execute", "public_access", "publish", "unpublish"]),
      grant("skill", "*", ["view", "create", "modify", "execute", "public_access", "publish", "unpublish"]),
      grant("mcp", "*", ["view", "create", "modify", "execute", "public_access", "publish", "unpublish"]),
    ],
    accessorIds: ["u-li", "dep-gov", "u-wang", "dep-rd"], updatedAt: daysAgo(8),
  },
  {
    id: "role-normal-user", name: "normal_user", description: "Regular user for viewing, querying, executing, and invoking module capabilities.",
    builtin: true, source: "business",
    permissions: [
      grant("catalog", "*", ["view_detail"]),
      grant("resource", "*", ["view_detail"]),
      grant("knowledge_network", "*", ["view_detail", "data_query"]),
      grant("small_model", "*", ["display", "execute"]),
      grant("large_model", "*", ["display", "execute"]),
      grant("operator", "*", ["view", "execute"]),
      grant("tool_box", "*", ["view", "execute"]),
      grant("skill", "*", ["view", "execute"]),
      grant("mcp", "*", ["view", "execute"]),
      grant("agent", "*", ["use"]),
    ],
    accessorIds: ["u-chen", "u-zhao"], updatedAt: daysAgo(45),
  },
];

const findUser = (id: string) => users.find((item) => item.id === id) ?? null;
const findDept = (id: string) => departments.find((item) => item.id === id) ?? null;
const findRole = (id: string) => roles.find((item) => item.id === id) ?? null;

function setBinding(roleId: string, accessorId: string, attach: boolean) {
  const role = findRole(roleId);
  if (!role) {
    return;
  }
  const has = role.accessorIds.includes(accessorId);
  if (attach && !has) {
    role.accessorIds = [...role.accessorIds, accessorId];
    role.updatedAt = now();
  }
  if (!attach && has) {
    role.accessorIds = role.accessorIds.filter((id) => id !== accessorId);
    role.updatedAt = now();
  }
}

// ---- reads ------------------------------------------------------------------

export async function listUsersPage(
  query: UserListQuery = {},
  options?: { skipErrorToast?: boolean },
): Promise<{ total: number; users: AdminUser[] }> {
  if (useMock) {
    const keyword = query.search?.trim().toLowerCase() ?? "";
    let list = users.filter((user) => {
      if (keyword && !`${user.name} ${user.account} ${user.email} ${user.telephone}`.toLowerCase().includes(keyword)) {
        return false;
      }
      if (query.enabled !== undefined && user.enabled !== query.enabled) {
        return false;
      }
      if (query.departmentId) {
        const ids = user.departmentIds ?? [];
        if (query.includeSubtree) {
          const subtree = collectDeptSubtree(query.departmentId);
          if (!ids.some((id) => subtree.has(id))) {
            return false;
          }
        } else if (!ids.includes(query.departmentId)) {
          return false;
        }
      }
      if (query.roleId) {
        const bound = roles.some(
          (role) => role.id === query.roleId && role.accessorIds.includes(user.id),
        );
        if (!bound) {
          return false;
        }
      }
      return true;
    });
    const total = list.length;
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 50;
    list = list.slice(offset, offset + limit);
    return wait({
      users: list.map((item) => enrichMockUserListItem(item)),
      total,
    });
  }
  const response = await http.get<{ total?: number; users?: BackendUser[] }>(`${ADMIN}/users`, {
    params: {
      search: query.search?.trim() || undefined,
      enabled: query.enabled === undefined ? undefined : String(query.enabled),
      department_id: query.departmentId || undefined,
      include_subtree: query.departmentId && query.includeSubtree ? "true" : undefined,
      role_id: query.roleId || undefined,
      offset: query.offset ?? 0,
      limit: query.limit ?? 50,
    },
    skipErrorToast: options?.skipErrorToast,
  });
  return {
    users: (response.data.users ?? []).map((item) => mapUser(item)),
    total: response.data.total ?? 0,
  };
}

export async function listUsers(options?: { skipErrorToast?: boolean }): Promise<AdminUser[]> {
  const result = await listUsersPage({ offset: 0, limit: 500 }, options);
  return result.users;
}

export async function listDepartments(): Promise<AdminDepartment[]> {
  if (useMock) {
    const subtreeCounts = computeSubtreeMemberCounts(departments, users);
    return wait(
      departments.map((item) => ({
        ...item,
        memberCount: users.filter((user) => (user.departmentIds ?? []).includes(item.id)).length,
        subtreeMemberCount: subtreeCounts.get(item.id) ?? 0,
      })),
    );
  }
  const response = await http.get<{ departments?: BackendDept[] }>(`${ADMIN}/departments`, {
    params: { offset: 0, limit: 1000 },
  });
  return (response.data.departments ?? []).map(mapDept);
}

function isRoleListItemComplete(item: BackendRole): boolean {
  return (
    Array.isArray(item.permissions) &&
    (Array.isArray(item.accessor_ids) || Array.isArray(item.members))
  );
}

export async function listRoles(options?: { withMembers?: boolean }): Promise<AdminRole[]> {
  if (useMock) {
    return wait(roles.map((item) => ({ ...item, accessorIds: [...item.accessorIds], permissions: item.permissions.map((p) => ({ ...p })) })));
  }
  const listResponse = await http.get<{ roles?: BackendRole[] }>(`${ADMIN}/roles`);
  const basics = listResponse.data.roles ?? [];
  const mapped = basics.map((item) => mapRole(item));
  if (!options?.withMembers) {
    return mapped;
  }
  const detailed = await Promise.all(
    basics.map(async (basic, index) => {
      if (isRoleListItemComplete(basic)) {
        return mapped[index];
      }
      try {
        const detail = await http.get<BackendRole>(`${ADMIN}/roles/${encodeURIComponent(basic.id)}`);
        return mapRole({ ...basic, ...detail.data });
      } catch {
        return mapped[index];
      }
    }),
  );
  return detailed;
}

export async function getRole(id: string, options?: { skipErrorToast?: boolean }): Promise<AdminRole> {
  if (useMock) {
    const role = findRole(id);
    if (!role) {
      throw new Error("role not found");
    }
    return wait({
      ...role,
      accessorIds: [...role.accessorIds],
      permissions: role.permissions.map((grant) => ({ ...grant, operations: [...grant.operations] })),
    });
  }
  const response = await http.get<BackendRole>(`${ADMIN}/roles/${encodeURIComponent(id)}`, {
    skipErrorToast: options?.skipErrorToast,
  });
  return mapRole(response.data);
}

export async function getUser(id: string): Promise<AdminUser> {
  if (useMock) {
    const user = findUser(id);
    if (!user) {
      throw new Error("user not found");
    }
    return wait({ ...user, departmentIds: [...(user.departmentIds ?? [])] });
  }
  const response = await http.get<BackendUser>(`${ADMIN}/users/${encodeURIComponent(id)}`);
  const mapped = mapUser(response.data, true);
  if (!mapped.roleIds.length && response.data.roles?.length) {
    mapped.roleIds = response.data.roles;
  }
  return mapped;
}

export async function listDepartmentMemberIds(
  deptId: string,
  options?: { skipErrorToast?: boolean },
): Promise<string[]> {
  const members = await listDepartmentMembers(deptId, options);
  return members.map((user) => user.id);
}

export async function listDepartmentMembers(
  deptId: string,
  options?: { skipErrorToast?: boolean },
): Promise<AdminUser[]> {
  if (useMock) {
    return wait(
      users
        .filter((user) => (user.departmentIds ?? []).includes(deptId))
        .map((user) => enrichMockUserListItem(user)),
    );
  }
  const response = await http.get<{ users?: BackendUser[] }>(
    `${ADMIN}/departments/${encodeURIComponent(deptId)}/members`,
    { skipErrorToast: options?.skipErrorToast },
  );
  return (response.data.users ?? []).map((item) => mapUser(item));
}

/** Idempotent department member writes via POST/DELETE /departments/:id/members {user_ids}. */
export async function setDepartmentMembers(
  deptId: string,
  userIds: string[],
  attach: boolean,
  options?: { skipErrorToast?: boolean },
): Promise<void> {
  if (useMock) {
    for (const user of users) {
      if (!userIds.includes(user.id)) {
        continue;
      }
      const current = new Set(user.departmentIds ?? []);
      if (attach) {
        current.add(deptId);
      } else {
        current.delete(deptId);
      }
      user.departmentIds = [...current];
    }
    await wait(undefined);
    return;
  }
  await http.request({
    url: `${ADMIN}/departments/${encodeURIComponent(deptId)}/members`,
    method: attach ? "POST" : "DELETE",
    data: { user_ids: userIds },
    skipErrorToast: options?.skipErrorToast,
  });
}

export async function listAuditLogs(
  query: AuditLogQuery,
): Promise<{ logs: AuditLog[]; total: number }> {
  if (useMock) {
    let logs = [...auditLog].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (query.resource) {
      logs = logs.filter((log) => log.resource === query.resource);
    }
    if (query.action) {
      logs = logs.filter((log) => log.action === query.action);
    }
    if (query.actorId) {
      logs = logs.filter((log) => log.actorId === query.actorId);
    }
    if (query.targetId) {
      logs = logs.filter((log) => log.targetId === query.targetId);
    }
    if (query.from) {
      logs = logs.filter((log) => log.createdAt >= query.from!);
    }
    if (query.to) {
      logs = logs.filter((log) => log.createdAt <= query.to!);
    }
    if (query.failedOnly) {
      logs = logs.filter((log) => log.status >= 400);
    }
    const total = logs.length;
    const offset = query.offset ?? 0;
    return wait({ logs: logs.slice(offset, offset + (query.limit ?? 50)), total });
  }
  const response = await http.get<{ logs?: BackendAudit[]; total?: number }>(`${ADMIN}/audit-logs`, {
    params: {
      actor_id: query.actorId || undefined,
      resource: query.resource || undefined,
      action: query.action || undefined,
      target_id: query.targetId || undefined,
      from: query.from || undefined,
      to: query.to || undefined,
      offset: query.offset ?? 0,
      limit: query.limit ?? 50,
    },
  });
  const all = (response.data.logs ?? []).map(mapAudit);
  // The backend has no status filter, so filter the current page on the frontend.
  const logs = query.failedOnly ? all.filter((log) => log.status >= 400) : all;
  return { logs, total: response.data.total ?? logs.length };
}

// ---- user writes ------------------------------------------------------------

export async function createUser(
  input: CreateUserInput,
  options?: { skipErrorToast?: boolean },
): Promise<void> {
  if (useMock) {
    if (users.some((item) => item.account === input.account)) {
      throw new Error(i18n.t("systemAdmin.errors.userAccountDuplicateWithAccount", { account: input.account }));
    }
    const user: AdminUser = {
      id: uid("u"),
      account: input.account,
      name: input.name || input.account,
      email: input.email,
      telephone: input.telephone,
      enabled: true,
      accountType: "local",
      roleIds: [],
      departmentIds: [...input.departmentIds],
      updatedAt: now(),
    };
    users = [...users, user];
    for (const roleId of input.roleIds) {
      setBinding(roleId, user.id, true);
    }
    await wait(undefined);
    return;
  }
  const created = await http.post<{ id: string }>(
    `${ADMIN}/users`,
    {
      account: input.account,
      password: input.password,
      name: input.name,
      email: input.email,
      telephone: input.telephone,
      ...(input.departmentIds.length ? { department_ids: input.departmentIds } : {}),
    },
    { skipErrorToast: options?.skipErrorToast },
  );
  const userId = created.data.id;
  await Promise.all(
    input.roleIds.map((roleId) =>
      http.post(
        `${ADMIN}/role-bindings`,
        { accessor_id: userId, role_id: roleId },
        { skipErrorToast: options?.skipErrorToast },
      ),
    ),
  );
}

export async function syncUserRoleBindings(
  accessorId: string,
  roleIds: string[],
  options?: { skipErrorToast?: boolean },
): Promise<void> {
  if (useMock) {
    for (const role of roles) {
      const has = role.accessorIds.includes(accessorId);
      const want = roleIds.includes(role.id);
      if (want !== has) {
        setBinding(role.id, accessorId, want);
      }
    }
    await wait(undefined);
    return;
  }
  const bound = await http.get<{ role_ids?: string[] }>(`${ADMIN}/role-bindings`, {
    params: { accessor_id: accessorId },
    skipErrorToast: options?.skipErrorToast,
  });
  const current = new Set(bound.data.role_ids ?? []);
  const want = new Set(roleIds);
  await Promise.all([
    ...[...want].filter((roleId) => !current.has(roleId)).map((roleId) =>
      http.post(
        `${ADMIN}/role-bindings`,
        { accessor_id: accessorId, role_id: roleId },
        { skipErrorToast: options?.skipErrorToast },
      ),
    ),
    ...[...current].filter((roleId) => !want.has(roleId)).map((roleId) =>
      http.delete(`${ADMIN}/role-bindings`, {
        data: { accessor_id: accessorId, role_id: roleId },
        skipErrorToast: options?.skipErrorToast,
      }),
    ),
  ]);
}

export async function updateUser(
  id: string,
  input: UpdateUserInput,
  options?: { skipErrorToast?: boolean },
): Promise<void> {
  if (useMock) {
    const user = findUser(id);
    if (!user) {
      throw new Error("user not found");
    }
    Object.assign(user, {
      name: input.name,
      email: input.email,
      telephone: input.telephone,
      enabled: input.enabled,
      departmentIds: [...input.departmentIds],
      updatedAt: now(),
    });
    await wait(undefined);
    return;
  }
  // department_ids has replace semantics; always send the current selection, including [].
  await http.put(
    `${ADMIN}/users/${encodeURIComponent(id)}`,
    {
      name: input.name,
      email: input.email,
      telephone: input.telephone,
      enabled: input.enabled,
      department_ids: input.departmentIds,
    },
    { skipErrorToast: options?.skipErrorToast },
  );
}

export async function deleteUser(id: string): Promise<void> {
  if (useMock) {
    const user = findUser(id);
    if (!user) {
      throw new Error("user not found");
    }
    if (user.builtin) {
      throw new Error(i18n.t("systemAdmin.errors.builtinAdminCannotDelete"));
    }
    for (const role of roles) {
      role.accessorIds = role.accessorIds.filter((accessorId) => accessorId !== id);
    }
    users = users.filter((item) => item.id !== id);
    await wait(undefined);
    return;
  }
  await http.delete(`${ADMIN}/users/${encodeURIComponent(id)}`);
}

export async function setUserEnabled(id: string, enabled: boolean): Promise<void> {
  if (useMock) {
    const user = findUser(id);
    if (!user) {
      throw new Error("user not found");
    }
    if (user.builtin && !enabled) {
      throw new Error(i18n.t("systemAdmin.errors.builtinAdminCannotDisable"));
    }
    user.enabled = enabled;
    user.updatedAt = now();
    await wait(undefined);
    return;
  }
  // bkn-safe has no dedicated enable/disable endpoint; update the enabled field via PUT.
  await http.put(`${ADMIN}/users/${encodeURIComponent(id)}`, { enabled });
}

export async function resetUserPassword(id: string, newPassword: string): Promise<void> {
  if (useMock) {
    await wait(undefined);
    return;
  }
  // Plaintext is protected by TLS; the backend enforces password change on first login.
  await http.put(`${ADMIN}/users/${encodeURIComponent(id)}/password`, { password: newPassword });
}

// ---- department writes ------------------------------------------------------

export async function createDepartment(input: DepartmentInput): Promise<void> {
  if (useMock) {
    departments = [
      ...departments,
      {
        id: uid("dep"),
        parentId: input.parentId ?? "dep-root",
        name: input.name,
        type: input.type ?? "dept",
        managerId: input.managerId || undefined,
        code: input.code || undefined,
        email: input.email || undefined,
        remark: input.remark || undefined,
      },
    ];
    await wait(undefined);
    return;
  }
  await http.post(`${ADMIN}/departments`, {
    name: input.name,
    ...(input.parentId ? { parent_id: input.parentId } : {}),
    ...(input.type ? { type: input.type } : {}),
    ...(input.managerId ? { manager_id: input.managerId } : {}),
    ...(input.code ? { code: input.code } : {}),
    ...(input.email ? { email: input.email } : {}),
    ...(input.remark ? { remark: input.remark } : {}),
  });
}

export async function updateDepartment(id: string, input: DepartmentInput): Promise<void> {
  if (useMock) {
    const dept = findDept(id);
    if (!dept) {
      throw new Error("department not found");
    }
    dept.name = input.name;
    dept.parentId = input.parentId;
    if (input.type) {
      dept.type = input.type;
    }
    dept.managerId = input.managerId || undefined;
    dept.code = input.code || undefined;
    dept.email = input.email || undefined;
    dept.remark = input.remark || undefined;
    await wait(undefined);
    return;
  }
  // parent_id "" means top-level; always send it to support re-parenting.
  await http.put(`${ADMIN}/departments/${encodeURIComponent(id)}`, {
    name: input.name,
    parent_id: input.parentId ?? "",
    ...(input.type ? { type: input.type } : {}),
    manager_id: input.managerId ?? "",
    code: input.code ?? "",
    email: input.email ?? "",
    remark: input.remark ?? "",
  });
}

export async function deleteDepartment(id: string): Promise<void> {
  if (useMock) {
    const dept = findDept(id);
    if (!dept) {
      throw new Error("department not found");
    }
    if (childDepartments(departments, id).length) {
      throw new Error(i18n.t("systemAdmin.errors.deleteChildDepartmentsFirst"));
    }
    departments = departments.filter((item) => item.id !== id);
    await wait(undefined);
    return;
  }
  // Non-cascade delete: the backend returns 409 when children or members exist.
  await http.delete(`${ADMIN}/departments/${encodeURIComponent(id)}`, {
    skipErrorToast: true,
  });
}

// ---- role writes ------------------------------------------------------------

export async function createRole(input: RoleInput): Promise<string> {
  if (useMock) {
    if (roles.some((item) => item.name === input.name)) {
      throw new Error(i18n.t("systemAdmin.errors.roleNameDuplicateWithName", { name: input.name }));
    }
    const id = uid("role");
    roles = [
      ...roles,
      {
        id,
        name: input.name,
        description: input.description,
        builtin: false,
        source: "user",
        permissions: [],
        accessorIds: [],
        updatedAt: now(),
      },
    ];
    await wait(undefined);
    return id;
  }
  const created = await http.post<{ id: string }>(`${ADMIN}/roles`, {
    name: input.name,
    description: input.description,
  });
  return created.data.id;
}

export async function updateRole(id: string, input: RoleInput): Promise<void> {
  if (useMock) {
    const role = findRole(id);
    if (!role) {
      throw new Error("role not found");
    }
    if (role.builtin) {
      throw new Error(i18n.t("systemAdmin.errors.builtinRoleCannotModify"));
    }
    role.name = input.name;
    role.description = input.description;
    role.updatedAt = now();
    await wait(undefined);
    return;
  }
  await http.put(`${ADMIN}/roles/${encodeURIComponent(id)}`, {
    name: input.name,
    description: input.description,
  });
}

export async function deleteRole(id: string): Promise<void> {
  if (useMock) {
    const role = findRole(id);
    if (!role) {
      throw new Error("role not found");
    }
    if (role.builtin) {
      throw new Error(i18n.t("systemAdmin.errors.builtinRoleCannotDelete"));
    }
    roles = roles.filter((item) => item.id !== id);
    await wait(undefined);
    return;
  }
  await http.delete(`${ADMIN}/roles/${encodeURIComponent(id)}`);
}

/** Binds a role member where accessor is a user or department. */
export async function setRoleMember(
  roleId: string,
  accessorId: string,
  attach: boolean,
): Promise<void> {
  if (useMock) {
    setBinding(roleId, accessorId, attach);
    await wait(undefined);
    return;
  }
  if (attach) {
    await http.post(`${ADMIN}/role-bindings`, { accessor_id: accessorId, role_id: roleId });
  } else {
    await http.delete(`${ADMIN}/role-bindings`, {
      data: { accessor_id: accessorId, role_id: roleId },
    });
  }
}

/** Grants or revokes role operations on one resource instance or a whole resource type. */
export async function setRolePermission(
  roleId: string,
  attach: boolean,
  perm: ResourceGrant,
): Promise<void> {
  if (useMock) {
    const role = findRole(roleId);
    if (!role) {
      throw new Error("role not found");
    }
    if (role.builtin) {
      throw new Error(i18n.t("systemAdmin.errors.builtinRolePermissionCannotModify"));
    }
    const existing = role.permissions.find(
      (item) => item.resource.type === perm.resource.type && item.resource.id === perm.resource.id,
    );
    if (attach) {
      if (existing) {
        existing.operations = Array.from(new Set([...existing.operations, ...perm.operations]));
      } else {
        role.permissions = [...role.permissions, { ...perm, operations: [...perm.operations] }];
      }
    } else if (existing) {
      existing.operations = existing.operations.filter((op) => !perm.operations.includes(op));
      role.permissions = role.permissions.filter(
        (item) => item !== existing || item.operations.length > 0,
      );
    }
    role.updatedAt = now();
    await wait(undefined);
    return;
  }
  await http.request({
    url: `${ADMIN}/roles/${encodeURIComponent(roleId)}/permissions`,
    method: attach ? "POST" : "DELETE",
    data: { resource: perm.resource, operations: perm.operations },
  });
}

// ---- backend mappers (real path) -------------------------------------------

type BackendUser = {
  Departments?: string[];
  account?: string;
  account_type?: string;
  department_ids?: string[];
  department_names?: string[];
  departments?: string[];
  email?: string;
  enabled?: boolean;
  id: string;
  name?: string;
  role_ids?: string[];
  role_names?: string[];
  roles?: string[];
  telephone?: string;
  update_time?: number;
  updated_at?: string;
};

type BackendAudit = {
  action?: string;
  actor_id?: string;
  client_ip?: string;
  created_at?: string;
  detail?: string;
  id: string;
  method?: string;
  resource?: string;
  status?: number;
  target_id?: string;
  target_name?: string;
};

// Department endpoints return PascalCase, unlike the lowercase users/roles payloads,
// so both naming styles are supported.
type BackendDept = {
  Code?: string;
  CreatedAt?: string;
  Email?: string;
  ID?: string;
  ManagerID?: string;
  ManagerId?: string;
  ManagerName?: string;
  MemberCount?: number;
  Name?: string;
  ParentID?: string | null;
  Remark?: string;
  SubtreeMemberCount?: number;
  Type?: string;
  code?: string;
  department_name?: string;
  dept_name?: string;
  email?: string;
  id?: string;
  manager_id?: string;
  manager_name?: string;
  member_count?: number;
  name?: string;
  parent_id?: string | null;
  remark?: string;
  subtree_member_count?: number;
  type?: string;
};

type BackendRole = {
  accessor_ids?: string[];
  built_in?: boolean;
  created_at?: string;
  description?: string;
  id: string;
  members?: string[];
  name?: string;
  permissions?: Array<{ resource?: { id?: string; type?: string }; operations?: string[] }>;
  source?: string;
  update_time?: number;
};

function parseUpdatedAt(item: BackendUser): number | undefined {
  if (item.update_time) {
    return item.update_time;
  }
  if (item.updated_at) {
    const parsed = Date.parse(item.updated_at);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function parseRoleCreatedAt(item: BackendRole): number | undefined {
  if (item.created_at) {
    const parsed = Date.parse(item.created_at);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return item.update_time;
}

function collectDeptSubtree(rootId: string): Set<string> {
  const out = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length) {
    const parentId = queue.shift()!;
    for (const dept of departments.filter((item) => item.parentId === parentId)) {
      if (!out.has(dept.id)) {
        out.add(dept.id);
        queue.push(dept.id);
      }
    }
  }
  return out;
}

function enrichMockUserListItem(user: AdminUser): AdminUser {
  const deptIds = user.departmentIds ?? [];
  const userRoles = roles.filter((role) => role.accessorIds.includes(user.id));
  return {
    ...user,
    departmentIds: [...deptIds],
    departmentNames: deptIds.map((id) => departments.find((dept) => dept.id === id)?.name ?? id),
    roleIds: userRoles.map((role) => role.id),
    roleNames: userRoles.map((role) => role.name),
  };
}

function mapUser(item: BackendUser, detail = false): AdminUser {
  const departmentIds = detail
    ? (item.departments ?? item.Departments ?? item.department_ids ?? [])
    : item.department_ids;
  const roleIds = item.role_ids ?? (detail ? item.roles ?? [] : []);
  return {
    id: item.id,
    account: item.account ?? item.id,
    name: item.name ?? item.account ?? item.id,
    email: item.email ?? "",
    telephone: item.telephone ?? "",
    enabled: item.enabled ?? true,
    accountType: item.account_type ?? "local",
    roleIds: roleIds ?? [],
    roleNames: item.role_names,
    departmentIds,
    departmentNames: item.department_names,
    updatedAt: parseUpdatedAt(item),
  };
}

function mapAudit(item: BackendAudit): AuditLog {
  return {
    id: item.id,
    actorId: item.actor_id ?? "",
    method: item.method ?? "",
    resource: item.resource ?? "",
    action: item.action ?? "",
    targetId: item.target_id ?? "",
    status: item.status ?? 0,
    clientIp: item.client_ip ?? "",
    createdAt: item.created_at ?? "",
    detail: item.detail ?? "",
    targetName: item.target_name || undefined,
  };
}

function mapDept(item: BackendDept): AdminDepartment {
  const id = item.ID ?? item.id ?? "";
  return {
    id,
    // ParentID "" means top-level and maps to null.
    parentId: item.ParentID || item.parent_id || null,
    name: item.Name || item.name || item.dept_name || item.department_name || id,
    type: item.Type ?? item.type ?? "dept",
    managerId: item.ManagerID || item.ManagerId || item.manager_id || undefined,
    managerName: item.ManagerName || item.manager_name || undefined,
    code: item.Code || item.code || undefined,
    email: item.Email || item.email || undefined,
    remark: item.Remark || item.remark || undefined,
    memberCount: item.MemberCount ?? item.member_count,
    subtreeMemberCount: item.SubtreeMemberCount ?? item.subtree_member_count,
  };
}

function mapRole(item: BackendRole): AdminRole {
  return {
    id: item.id,
    name: item.name ?? item.id,
    description: item.description ?? "",
    builtin: item.built_in ?? false,
    source: item.source,
    permissions: (item.permissions ?? []).map((perm) => ({
      resource: { type: perm.resource?.type ?? "", id: perm.resource?.id ?? "*" },
      operations: perm.operations ?? [],
    })),
    accessorIds: item.accessor_ids ?? item.members ?? [],
    updatedAt: parseRoleCreatedAt(item),
  };
}
