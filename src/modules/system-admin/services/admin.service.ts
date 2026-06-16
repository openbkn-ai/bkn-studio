import { http } from "@/framework/request/http";
import { childDepartments, deptUsers } from "@/modules/system-admin/utils/admin-helpers";
import type {
  AdminDepartment,
  AdminRole,
  AdminUser,
  CreateUserInput,
  DepartmentInput,
  RoleInput,
  RoleMember,
  UpdateUserInput,
} from "@/modules/system-admin/types/admin";

/**
 * 系统管理服务层 —— 镜像 @openbkn/bkn-sdk 的 admin 客户端
 * (user-management + authorization)。默认走前端 mock；将 VITE_USE_MOCK
 * 设为 "false" 时改打真实后端。真实写路径中的用户/部门走 ISFWeb thrift
 * (ShareMgnt)，由 BFF 代理为 JSON；这里按 SDK 的契约组织请求。
 */
const useMock = import.meta.env.VITE_USE_MOCK !== "false";

const UM = "/user-management/v1";
const AUTHZ = "/authorization/v1";

const wait = async <T,>(value: T) =>
  new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(value), 160);
  });

const now = () => Date.now();
const daysAgo = (days: number) => now() - days * 86_400_000;
const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

// ---- mock store -------------------------------------------------------------

let departments: AdminDepartment[] = [
  { id: "dep-root", parentId: null, name: "BKN 平台", code: "HQ", managerId: "u-admin", email: "platform@bkn.local", remark: "组织根节点", enabled: true },
  { id: "dep-data", parentId: "dep-root", name: "数据智能部", code: "DI", managerId: "u-chen", email: "", remark: "", enabled: true },
  { id: "dep-ke", parentId: "dep-data", name: "知识工程组", code: "DI-KE", managerId: "u-chen", email: "", remark: "", enabled: true },
  { id: "dep-gov", parentId: "dep-data", name: "数据治理组", code: "DI-GOV", managerId: "u-li", email: "", remark: "", enabled: true },
  { id: "dep-rd", parentId: "dep-root", name: "平台研发部", code: "RD", managerId: "u-wang", email: "", remark: "", enabled: true },
  { id: "dep-cs", parentId: "dep-root", name: "客户成功部", code: "CS", managerId: null, email: "", remark: "", enabled: true },
];

let users: AdminUser[] = [
  { id: "u-admin", account: "local-admin", name: "Local Admin", email: "admin@bkn.local", position: "平台管理员", deptIds: ["dep-root"], enabled: true, frozen: false, remark: "内置管理员账号", updatedAt: daysAgo(2), builtin: true },
  { id: "u-chen", account: "chen.yanqiu", name: "陈砚秋", email: "chen.yanqiu@bkn.local", position: "知识工程负责人", deptIds: ["dep-ke"], enabled: true, frozen: false, remark: "", updatedAt: daysAgo(4) },
  { id: "u-li", account: "li.mubai", name: "李慕白", email: "li.mubai@bkn.local", position: "数据管理员", deptIds: ["dep-gov"], enabled: true, frozen: false, remark: "", updatedAt: daysAgo(9) },
  { id: "u-wang", account: "wang.xiaoou", name: "王晓鸥", email: "wang.xiaoou@bkn.local", position: "高级工程师", deptIds: ["dep-rd"], enabled: true, frozen: true, remark: "连续登录失败已冻结", updatedAt: daysAgo(1) },
  { id: "u-zhao", account: "zhao.qinglan", name: "赵清岚", email: "zhao.qinglan@bkn.local", position: "客户成功经理", deptIds: ["dep-cs"], enabled: false, frozen: false, remark: "离职流程中", updatedAt: daysAgo(15) },
];

let roles: AdminRole[] = [
  {
    id: "role-super-admin", name: "super_admin", displayName: "超级管理员", builtin: true,
    description: "平台全量权限，含系统管理与授权。",
    permissions: ["admin:*", "ontology-manager:*", "vega:catalog:*", "vega:resource:*", "vega:build", "model:manage", "model:invoke", "agent:*", "skill:*", "trace:read"],
    members: [{ id: "u-admin", type: "user" }], updatedAt: daysAgo(30),
  },
  {
    id: "role-kn-admin", name: "kn_admin", displayName: "知识网络管理员", builtin: false,
    description: "管理知识网络本体与索引构建。",
    permissions: ["ontology-manager:*", "vega:read", "vega:build", "model:invoke"],
    members: [{ id: "u-chen", type: "user" }], updatedAt: daysAgo(12),
  },
  {
    id: "role-data-steward", name: "data_steward", displayName: "数据管理员", builtin: false,
    description: "管理数据连接、资源与数据质量。",
    permissions: ["vega:catalog:*", "vega:resource:*", "vega:build"],
    members: [{ id: "u-li", type: "user" }, { id: "dep-gov", type: "department" }], updatedAt: daysAgo(8),
  },
  {
    id: "role-developer", name: "developer", displayName: "开发者", builtin: false,
    description: "构建智能体、技能与工具箱，可调用模型。",
    permissions: ["agent:*", "skill:*", "model:invoke", "trace:read"],
    members: [{ id: "u-wang", type: "user" }, { id: "dep-rd", type: "department" }], updatedAt: daysAgo(20),
  },
  {
    id: "role-viewer", name: "viewer", displayName: "只读访客", builtin: true,
    description: "全平台只读访问。",
    permissions: ["ontology-manager:read", "vega:read", "trace:read"],
    members: [{ id: "u-zhao", type: "user" }], updatedAt: daysAgo(45),
  },
];

const findUser = (id: string) => users.find((item) => item.id === id) ?? null;
const findDept = (id: string) => departments.find((item) => item.id === id) ?? null;
const findRole = (id: string) => roles.find((item) => item.id === id) ?? null;

function applyRoleMembership(roleId: string, member: RoleMember, attach: boolean) {
  const role = findRole(roleId);
  if (!role) {
    return;
  }
  const exists = role.members.some((m) => m.id === member.id && m.type === member.type);
  if (attach && !exists) {
    role.members = [...role.members, member];
    role.updatedAt = now();
  }
  if (!attach && exists) {
    role.members = role.members.filter((m) => !(m.id === member.id && m.type === member.type));
    role.updatedAt = now();
  }
}

// ---- reads ------------------------------------------------------------------

export async function listDepartments(): Promise<AdminDepartment[]> {
  if (useMock) {
    return wait(departments.map((item) => ({ ...item })));
  }
  const response = await http.get<{ entries: BackendDept[] }>(
    `${UM}/console/search-departments/name,code,remark,manager,enabled,parent_deps,email`,
    { params: { role: "super_admin", offset: 0, limit: 200 } },
  );
  return (response.data.entries ?? []).map(mapDept);
}

export async function listUsers(): Promise<AdminUser[]> {
  if (useMock) {
    return wait(users.map((item) => ({ ...item, deptIds: [...item.deptIds] })));
  }
  const response = await http.get<{ entries: BackendUser[] }>(
    `${UM}/console/search-users/name,account,email,enabled,frozen,parent_deps,roles`,
    { params: { role: "super_admin", offset: 0, limit: 200 } },
  );
  return (response.data.entries ?? []).map(mapUser);
}

export async function listRoles(): Promise<AdminRole[]> {
  if (useMock) {
    return wait(roles.map((item) => ({ ...item, members: [...item.members] })));
  }
  const response = await http.get<{ entries: BackendRole[] }>(`${AUTHZ}/roles`, {
    params: { offset: 0, limit: 200 },
  });
  return (response.data.entries ?? []).map(mapRole);
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
      position: input.position,
      deptIds: input.deptIds.length ? input.deptIds : ["dep-root"],
      enabled: true,
      frozen: false,
      remark: input.remark,
      updatedAt: now(),
    };
    users = [...users, user];
    for (const roleId of input.roleIds) {
      applyRoleMembership(roleId, { id: user.id, type: "user" }, true);
    }
    await wait(undefined);
    return;
  }
  // ShareMgnt.Usrm_AddUser —— 不设密码，使用平台默认密码（首次登录强制改）。
  await http.post(`${UM}/users`, {
    login_name: input.account,
    display_name: input.name,
    email: input.email,
    position: input.position,
    department_ids: input.deptIds,
    remark: input.remark,
  });
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
      position: input.position,
      deptIds: input.deptIds,
      remark: input.remark,
      updatedAt: now(),
    });
    for (const role of roles) {
      const has = role.members.some((m) => m.type === "user" && m.id === id);
      const want = input.roleIds.includes(role.id);
      if (want !== has) {
        applyRoleMembership(role.id, { id, type: "user" }, want);
      }
    }
    await wait(undefined);
    return;
  }
  await http.patch(`${UM}/management/users/${encodeURIComponent(id)}`, {
    display_name: input.name,
    email: input.email,
    position: input.position,
    remark: input.remark,
  });
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
      role.members = role.members.filter((m) => !(m.type === "user" && m.id === id));
    }
    users = users.filter((item) => item.id !== id);
    await wait(undefined);
    return;
  }
  await http.delete(`${UM}/users/${encodeURIComponent(id)}`);
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
    if (enabled) {
      user.frozen = false;
    }
    user.updatedAt = now();
    await wait(undefined);
    return;
  }
  await http.post(`${UM}/management/users/${encodeURIComponent(id)}/${enabled ? "enable" : "disable"}`);
}

export async function unfreezeUser(id: string): Promise<void> {
  if (useMock) {
    const user = findUser(id);
    if (user) {
      user.frozen = false;
      user.updatedAt = now();
    }
    await wait(undefined);
    return;
  }
  await http.post(`${UM}/management/users/${encodeURIComponent(id)}/unfreeze`);
}

export async function resetUserPassword(id: string, newPassword: string): Promise<void> {
  if (useMock) {
    await wait(undefined);
    return;
  }
  // PUT /management/users/:id/password —— 真实环境密码需 RSA-PKCS1 加密后传输。
  await http.put(`${UM}/management/users/${encodeURIComponent(id)}/password`, {
    password: newPassword,
  });
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
        code: input.code,
        managerId: input.managerId,
        email: input.email ?? "",
        remark: input.remark,
        enabled: true,
      },
    ];
    await wait(undefined);
    return;
  }
  await http.post(`${UM}/departments`, {
    name: input.name,
    parent_id: input.parentId ?? "-1",
    code: input.code,
    manager_id: input.managerId,
    remark: input.remark,
    email: input.email ?? "",
  });
}

export async function updateDepartment(id: string, input: DepartmentInput): Promise<void> {
  if (useMock) {
    const dept = findDept(id);
    if (!dept) {
      throw new Error("department not found");
    }
    Object.assign(dept, {
      name: input.name,
      code: input.code,
      managerId: input.managerId,
      remark: input.remark,
      parentId: dept.parentId ? (input.parentId ?? dept.parentId) : null,
    });
    await wait(undefined);
    return;
  }
  await http.patch(`${UM}/management/departments/${encodeURIComponent(id)}`, {
    name: input.name,
    code: input.code,
    manager_id: input.managerId,
    remark: input.remark,
  });
}

export async function deleteDepartment(id: string): Promise<void> {
  if (useMock) {
    const dept = findDept(id);
    if (!dept) {
      throw new Error("department not found");
    }
    if (!dept.parentId) {
      throw new Error("根部门不可删除");
    }
    if (childDepartments(departments, id).length) {
      throw new Error("请先删除其下级部门");
    }
    const memberCount = deptUsers(users, id).length;
    if (memberCount) {
      throw new Error(`部门下仍有 ${memberCount} 名成员，请先移出`);
    }
    departments = departments.filter((item) => item.id !== id);
    await wait(undefined);
    return;
  }
  await http.delete(`${UM}/management/departments/${encodeURIComponent(id)}`);
}

// ---- role writes ------------------------------------------------------------

export async function createRole(input: RoleInput): Promise<void> {
  if (useMock) {
    if (roles.some((item) => item.name === input.name)) {
      throw new Error(`角色标识已存在：${input.name}`);
    }
    roles = [
      ...roles,
      {
        id: uid("role"),
        name: input.name,
        displayName: input.displayName || input.name,
        builtin: false,
        description: input.description,
        permissions: [...input.permissions],
        members: [],
        updatedAt: now(),
      },
    ];
    await wait(undefined);
    return;
  }
  await http.post(`${AUTHZ}/roles`, {
    name: input.name,
    display_name: input.displayName,
    description: input.description,
    permissions: input.permissions,
  });
}

export async function updateRole(
  id: string,
  patch: Partial<RoleInput>,
): Promise<void> {
  if (useMock) {
    const role = findRole(id);
    if (!role) {
      throw new Error("role not found");
    }
    if (role.builtin && patch.permissions) {
      throw new Error("内置角色的权限不可修改");
    }
    if (patch.displayName !== undefined) {
      role.displayName = patch.displayName;
    }
    if (patch.description !== undefined) {
      role.description = patch.description;
    }
    if (patch.permissions !== undefined) {
      role.permissions = [...patch.permissions];
    }
    role.updatedAt = now();
    await wait(undefined);
    return;
  }
  await http.put(`${AUTHZ}/roles/${encodeURIComponent(id)}`, {
    display_name: patch.displayName,
    description: patch.description,
    permissions: patch.permissions,
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
  await http.delete(`${AUTHZ}/roles/${encodeURIComponent(id)}`);
}

export async function modifyRoleMembers(
  roleId: string,
  method: "POST" | "DELETE",
  members: RoleMember[],
): Promise<void> {
  if (useMock) {
    for (const member of members) {
      applyRoleMembership(roleId, member, method === "POST");
    }
    await wait(undefined);
    return;
  }
  // 增删都用 POST，动作在 body 里（{method, members}）。
  await http.post(`${AUTHZ}/role-members/${encodeURIComponent(roleId)}`, {
    method,
    members,
  });
}

// ---- backend mappers (real path) -------------------------------------------

type BackendDept = {
  code?: string;
  email?: string;
  enabled?: boolean;
  id: string;
  manager?: { id?: string } | null;
  name?: string;
  parent_deps?: Array<{ id: string }>;
  remark?: string;
};

type BackendUser = {
  account?: string;
  email?: string;
  enabled?: boolean;
  frozen?: boolean;
  id: string;
  name?: string;
  parent_deps?: Array<{ id: string }>;
  position?: string;
  remark?: string;
  update_time?: number;
};

type BackendRole = {
  builtin?: boolean;
  description?: string;
  display_name?: string;
  id: string;
  members?: Array<{ id: string; type?: string }>;
  name?: string;
  permissions?: string[];
  update_time?: number;
};

function mapDept(item: BackendDept): AdminDepartment {
  return {
    id: item.id,
    parentId: item.parent_deps?.[0]?.id ?? null,
    name: item.name ?? item.id,
    code: item.code ?? "",
    managerId: item.manager?.id ?? null,
    email: item.email ?? "",
    remark: item.remark ?? "",
    enabled: item.enabled ?? true,
  };
}

function mapUser(item: BackendUser): AdminUser {
  return {
    id: item.id,
    account: item.account ?? item.id,
    name: item.name ?? item.account ?? item.id,
    email: item.email ?? "",
    position: item.position ?? "",
    deptIds: (item.parent_deps ?? []).map((dep) => dep.id),
    enabled: item.enabled ?? true,
    frozen: item.frozen ?? false,
    remark: item.remark ?? "",
    updatedAt: item.update_time ?? Date.now(),
  };
}

function mapRole(item: BackendRole): AdminRole {
  return {
    id: item.id,
    name: item.name ?? item.id,
    displayName: item.display_name ?? item.name ?? item.id,
    builtin: item.builtin ?? false,
    description: item.description ?? "",
    permissions: item.permissions ?? [],
    members: (item.members ?? []).map((member) => ({
      id: member.id,
      type: member.type === "department" ? "department" : "user",
    })),
    updatedAt: item.update_time ?? Date.now(),
  };
}
