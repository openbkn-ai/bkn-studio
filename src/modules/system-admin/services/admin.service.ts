import { http } from "@/framework/request/http";
import { childDepartments } from "@/modules/system-admin/utils/admin-helpers";
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
} from "@/modules/system-admin/types/admin";

/**
 * 系统管理服务层 —— 对齐 bkn-safe 的 token-gated admin API
 * `/api/safe/v1/admin/*`（ISF 退役后的统一入口）。默认走前端 mock；
 * VITE_USE_MOCK=false 时改打真实后端。
 *
 * 后端暂不支持、已从写路径剔除（等后端反馈）：冻结/解冻、部门扩展字段
 * （负责人/编码/邮箱/备注）、用户↔部门归属写入。
 */
const useMock = import.meta.env.VITE_USE_MOCK === "true";

const ADMIN = "/safe/v1/admin";
export const DEFAULT_NEW_USER_PASSWORD = "openbkn"; // 平台初始密码，首登提示改

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
  { id: "dep-root", parentId: null, name: "BKN 平台", type: "org" },
  { id: "dep-data", parentId: "dep-root", name: "数据智能部", type: "dept" },
  { id: "dep-ke", parentId: "dep-data", name: "知识工程组", type: "dept" },
  { id: "dep-gov", parentId: "dep-data", name: "数据治理组", type: "dept" },
  { id: "dep-rd", parentId: "dep-root", name: "平台研发部", type: "dept" },
  { id: "dep-cs", parentId: "dep-root", name: "客户成功部", type: "dept" },
];

let users: AdminUser[] = [
  { id: "u-admin", account: "local-admin", name: "Local Admin", email: "admin@bkn.local", telephone: "", enabled: true, accountType: "local", builtin: true, roleIds: [], departmentIds: ["dep-root"], updatedAt: daysAgo(2) },
  { id: "u-chen", account: "chen.yanqiu", name: "陈砚秋", email: "chen.yanqiu@bkn.local", telephone: "", enabled: true, accountType: "local", roleIds: [], departmentIds: ["dep-ke"], updatedAt: daysAgo(4) },
  { id: "u-li", account: "li.mubai", name: "李慕白", email: "li.mubai@bkn.local", telephone: "", enabled: true, accountType: "local", roleIds: [], departmentIds: ["dep-gov"], updatedAt: daysAgo(9) },
  { id: "u-wang", account: "wang.xiaoou", name: "王晓鸥", email: "wang.xiaoou@bkn.local", telephone: "", enabled: true, accountType: "local", roleIds: [], departmentIds: ["dep-rd"], updatedAt: daysAgo(1) },
  { id: "u-zhao", account: "zhao.qinglan", name: "赵清岚", email: "zhao.qinglan@bkn.local", telephone: "", enabled: false, accountType: "local", roleIds: [], departmentIds: ["dep-cs"], updatedAt: daysAgo(15) },
];

const auditLog: AuditLog[] = [
  { id: "al-1", actorId: "u-admin", method: "POST", resource: "users", action: "users", targetId: "u-chen", status: 201, clientIp: "10.0.0.2", createdAt: new Date(daysAgo(4)).toISOString() },
  { id: "al-2", actorId: "u-admin", method: "POST", resource: "roles", action: "roles.permissions", targetId: "role-data-steward", status: 204, clientIp: "10.0.0.2", createdAt: new Date(daysAgo(3)).toISOString() },
  { id: "al-3", actorId: "u-admin", method: "DELETE", resource: "users", action: "users", targetId: "u-ghost", status: 404, clientIp: "10.0.0.2", createdAt: new Date(daysAgo(2)).toISOString() },
  { id: "al-4", actorId: "u-li", method: "POST", resource: "departments", action: "departments.members", targetId: "dep-gov", status: 204, clientIp: "10.0.0.5", createdAt: new Date(daysAgo(1)).toISOString() },
  { id: "al-5", actorId: "u-admin", method: "POST", resource: "role-bindings", action: "role-bindings", targetId: "", status: 204, clientIp: "10.0.0.2", createdAt: new Date(daysAgo(1)).toISOString() },
];

let roles: AdminRole[] = [
  {
    id: "role-super-admin", name: "super_admin", description: "平台全量权限，含系统管理与授权。",
    builtin: true, source: "system",
    permissions: [grant("*", "*", ["*"])],
    accessorIds: ["u-admin"], updatedAt: daysAgo(30),
  },
  {
    id: "role-data-steward", name: "data_steward", description: "管理数据连接、资源与索引构建。",
    builtin: false, source: "user",
    permissions: [
      grant("catalog", "*", ["view", "edit", "delete", "enable", "disable", "test_connection"]),
      grant("resource", "*", ["view", "edit", "build"]),
    ],
    accessorIds: ["u-li", "dep-gov"], updatedAt: daysAgo(8),
  },
  {
    id: "role-kn-admin", name: "kn_admin", description: "管理知识网络本体与索引构建。",
    builtin: false, source: "user",
    permissions: [
      grant("knowledge_network", "*", ["view", "edit", "manage"]),
      grant("resource", "*", ["view", "build"]),
    ],
    accessorIds: ["u-chen"], updatedAt: daysAgo(12),
  },
  {
    id: "role-developer", name: "developer", description: "构建智能体、技能与工具箱，可调用模型。",
    builtin: false, source: "user",
    permissions: [
      grant("agent", "*", ["view", "manage", "invoke"]),
      grant("skill", "*", ["view", "manage"]),
    ],
    accessorIds: ["u-wang", "dep-rd"], updatedAt: daysAgo(20),
  },
  {
    id: "role-viewer", name: "viewer", description: "受限只读：全部数据资源 + 指定一条数据连接。",
    builtin: true, source: "system",
    permissions: [
      grant("resource", "*", ["view"]),
      grant("catalog", "cat-003", ["view"]), // 对象级授权示例：只授某一条数据连接
    ],
    accessorIds: ["u-zhao"], updatedAt: daysAgo(45),
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

export async function listUsers(): Promise<AdminUser[]> {
  if (useMock) {
    return wait(users.map((item) => ({ ...item })));
  }
  const response = await http.get<{ users?: BackendUser[] }>(`${ADMIN}/users`, {
    params: { offset: 0, limit: 500 },
  });
  return (response.data.users ?? []).map((item) => mapUser(item));
}

export async function listDepartments(): Promise<AdminDepartment[]> {
  if (useMock) {
    return wait(departments.map((item) => ({ ...item })));
  }
  const response = await http.get<{ departments?: BackendDept[] }>(`${ADMIN}/departments`, {
    params: { offset: 0, limit: 1000 },
  });
  return (response.data.departments ?? []).map(mapDept);
}

export async function listRoles(): Promise<AdminRole[]> {
  if (useMock) {
    return wait(roles.map((item) => ({ ...item, accessorIds: [...item.accessorIds], permissions: item.permissions.map((p) => ({ ...p })) })));
  }
  // 列表只给基础字段；成员 + 权限要逐角色取详情（角色数量很小）。
  const listResponse = await http.get<{ roles?: BackendRole[] }>(`${ADMIN}/roles`);
  const basics = listResponse.data.roles ?? [];
  const detailed = await Promise.all(
    basics.map(async (basic) => {
      try {
        const detail = await http.get<BackendRole>(`${ADMIN}/roles/${encodeURIComponent(basic.id)}`);
        return mapRole({ ...basic, ...detail.data });
      } catch {
        return mapRole(basic);
      }
    }),
  );
  return detailed;
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
  return mapUser(response.data, true);
}

export async function listDepartmentMemberIds(deptId: string): Promise<string[]> {
  if (useMock) {
    return wait(users.filter((user) => (user.departmentIds ?? []).includes(deptId)).map((user) => user.id));
  }
  const response = await http.get<{
    Users?: Array<{ ID?: string; id?: string }>;
    users?: Array<{ ID?: string; id?: string }>;
  }>(`${ADMIN}/departments/${encodeURIComponent(deptId)}/members`);
  const list = response.data.users ?? response.data.Users ?? [];
  return list.map((item) => item.id ?? item.ID ?? "").filter(Boolean);
}

/** 部门成员写（幂等）：POST/DELETE /departments/:id/members {user_ids}。 */
export async function setDepartmentMembers(
  deptId: string,
  userIds: string[],
  attach: boolean,
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
      from: query.from || undefined,
      to: query.to || undefined,
      offset: query.offset ?? 0,
      limit: query.limit ?? 50,
    },
  });
  const all = (response.data.logs ?? []).map(mapAudit);
  // status 过滤后端无参数，前端筛（注意分页：仅对当前页过滤）。
  const logs = query.failedOnly ? all.filter((log) => log.status >= 400) : all;
  return { logs, total: response.data.total ?? logs.length };
}

// ---- user writes ------------------------------------------------------------

export async function createUser(input: CreateUserInput): Promise<void> {
  if (useMock) {
    if (users.some((item) => item.account === input.account)) {
      throw new Error(`登录名已存在：${input.account}`);
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
  const created = await http.post<{ id: string }>(`${ADMIN}/users`, {
    account: input.account,
    password: input.password || DEFAULT_NEW_USER_PASSWORD,
    name: input.name,
    email: input.email,
    telephone: input.telephone,
    ...(input.departmentIds.length ? { department_ids: input.departmentIds } : {}),
  });
  const userId = created.data.id;
  await Promise.all(
    input.roleIds.map((roleId) =>
      http.post(`${ADMIN}/role-bindings`, { accessor_id: userId, role_id: roleId }),
    ),
  );
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<void> {
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
    for (const role of roles) {
      const has = role.accessorIds.includes(id);
      const want = input.roleIds.includes(role.id);
      if (want !== has) {
        setBinding(role.id, id, want);
      }
    }
    await wait(undefined);
    return;
  }
  // department_ids 替换语义：始终传当前选择集（含 [] 清空）。
  await http.put(`${ADMIN}/users/${encodeURIComponent(id)}`, {
    name: input.name,
    email: input.email,
    telephone: input.telephone,
    enabled: input.enabled,
    department_ids: input.departmentIds,
  });
  const bound = await http.get<{ role_ids?: string[] }>(`${ADMIN}/role-bindings`, {
    params: { accessor_id: id },
  });
  const current = new Set(bound.data.role_ids ?? []);
  const want = new Set(input.roleIds);
  await Promise.all([
    ...[...want].filter((roleId) => !current.has(roleId)).map((roleId) =>
      http.post(`${ADMIN}/role-bindings`, { accessor_id: id, role_id: roleId }),
    ),
    ...[...current].filter((roleId) => !want.has(roleId)).map((roleId) =>
      http.delete(`${ADMIN}/role-bindings`, { data: { accessor_id: id, role_id: roleId } }),
    ),
  ]);
}

export async function deleteUser(id: string): Promise<void> {
  if (useMock) {
    const user = findUser(id);
    if (!user) {
      throw new Error("user not found");
    }
    if (user.builtin) {
      throw new Error("内置管理员账号不可删除");
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
      throw new Error("内置管理员账号不可停用");
    }
    user.enabled = enabled;
    user.updatedAt = now();
    await wait(undefined);
    return;
  }
  // bkn-safe 无单独 enable/disable 端点，经 PUT 改 enabled 字段。
  await http.put(`${ADMIN}/users/${encodeURIComponent(id)}`, { enabled });
}

export async function resetUserPassword(id: string, newPassword: string): Promise<void> {
  if (useMock) {
    await wait(undefined);
    return;
  }
  // 明文走 TLS（bkn-safe 无 RSA/thrift），后端置「首登强制改密」。
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
      },
    ];
    await wait(undefined);
    return;
  }
  await http.post(`${ADMIN}/departments`, {
    name: input.name,
    ...(input.parentId ? { parent_id: input.parentId } : {}),
    ...(input.type ? { type: input.type } : {}),
  });
}

export async function updateDepartment(id: string, input: DepartmentInput): Promise<void> {
  if (useMock) {
    const dept = findDept(id);
    if (!dept) {
      throw new Error("department not found");
    }
    dept.name = input.name;
    dept.parentId = input.parentId; // 允许改上级（含移到顶层 = null）
    if (input.type) {
      dept.type = input.type;
    }
    await wait(undefined);
    return;
  }
  // parent_id "" = 顶层；始终下发以支持改上级 / 拖拽 re-parent。
  await http.put(`${ADMIN}/departments/${encodeURIComponent(id)}`, {
    name: input.name,
    parent_id: input.parentId ?? "",
    ...(input.type ? { type: input.type } : {}),
  });
}

export async function deleteDepartment(id: string): Promise<void> {
  if (useMock) {
    const dept = findDept(id);
    if (!dept) {
      throw new Error("department not found");
    }
    if (childDepartments(departments, id).length) {
      throw new Error("请先删除其下级部门");
    }
    departments = departments.filter((item) => item.id !== id);
    await wait(undefined);
    return;
  }
  // 非级联：有子部门/成员时后端返 409。
  await http.delete(`${ADMIN}/departments/${encodeURIComponent(id)}`);
}

// ---- role writes ------------------------------------------------------------

export async function createRole(input: RoleInput): Promise<string> {
  if (useMock) {
    if (roles.some((item) => item.name === input.name)) {
      throw new Error(`角色标识已存在：${input.name}`);
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
      throw new Error("内置角色不可修改");
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
      throw new Error("内置角色不可删除");
    }
    roles = roles.filter((item) => item.id !== id);
    await wait(undefined);
    return;
  }
  await http.delete(`${ADMIN}/roles/${encodeURIComponent(id)}`);
}

/** 角色绑定成员（accessor = 用户或部门）。 */
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

/** 对象级授权：给/收回角色对某资源实例（或整类 *）的操作。 */
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
      throw new Error("内置角色的权限不可修改");
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
  departments?: string[];
  email?: string;
  enabled?: boolean;
  id: string;
  name?: string;
  telephone?: string;
  update_time?: number;
};

type BackendAudit = {
  action?: string;
  actor_id?: string;
  client_ip?: string;
  created_at?: string;
  id: string;
  method?: string;
  resource?: string;
  status?: number;
  target_id?: string;
};

// 注意：departments 端点返 PascalCase（ID/Name/ParentID/Type），与 users/roles
// 的小写不一致，故两种命名都兼容。
type BackendDept = {
  CreatedAt?: string;
  ID?: string;
  MemberCount?: number;
  Name?: string;
  ParentID?: string | null;
  Type?: string;
  department_name?: string;
  dept_name?: string;
  id?: string;
  member_count?: number;
  name?: string;
  parent_id?: string | null;
  type?: string;
};

type BackendRole = {
  accessor_ids?: string[];
  built_in?: boolean;
  description?: string;
  id: string;
  members?: string[];
  name?: string;
  permissions?: Array<{ resource?: { id?: string; type?: string }; operations?: string[] }>;
  source?: string;
  update_time?: number;
};

function mapUser(item: BackendUser, detail = false): AdminUser {
  return {
    id: item.id,
    account: item.account ?? item.id,
    name: item.name ?? item.account ?? item.id,
    email: item.email ?? "",
    telephone: item.telephone ?? "",
    enabled: item.enabled ?? true,
    accountType: item.account_type ?? "local",
    roleIds: [],
    // 列表接口不返 departments；仅详情(GET /users/:id)有。
    departmentIds: detail ? (item.departments ?? item.Departments ?? []) : undefined,
    updatedAt: item.update_time,
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
  };
}

function mapDept(item: BackendDept): AdminDepartment {
  const id = item.ID ?? item.id ?? "";
  return {
    id,
    // ParentID "" = 顶层 → null（|| 同时兜住 "" 和 undefined）。
    parentId: item.ParentID || item.parent_id || null,
    name: item.Name || item.name || item.dept_name || item.department_name || id,
    type: item.Type ?? item.type ?? "dept",
    memberCount: item.MemberCount ?? item.member_count,
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
    updatedAt: item.update_time,
  };
}
