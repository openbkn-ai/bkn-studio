import type {
  AdminDepartment,
  AdminRole,
  AdminUser,
  DeptTreeEntry,
} from "@/modules/system-admin/types/admin";

/** 部门树扁平化（带层级深度，用于缩进渲染与下拉选择）。 */
export function buildDeptTree(departments: AdminDepartment[]): DeptTreeEntry[] {
  const out: DeptTreeEntry[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const dept of departments.filter((item) => item.parentId === parentId)) {
      out.push({ dept, depth });
      walk(dept.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** 从根到目标部门的路径，例如「BKN 平台 / 数据智能部 / 数据治理组」。 */
export function deptPath(departments: AdminDepartment[], deptId?: string): string {
  const parts: string[] = [];
  let current = departments.find((item) => item.id === deptId) ?? null;
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    parts.unshift(current.name);
    current = current.parentId
      ? (departments.find((item) => item.id === current?.parentId) ?? null)
      : null;
  }
  return parts.join(" / ");
}

export function deptUsers(users: AdminUser[], deptId: string): AdminUser[] {
  return users.filter((user) => user.deptIds.includes(deptId));
}

export function childDepartments(
  departments: AdminDepartment[],
  parentId: string,
): AdminDepartment[] {
  return departments.filter((item) => item.parentId === parentId);
}

export function rolesOfUser(roles: AdminRole[], userId: string): AdminRole[] {
  return roles.filter((role) =>
    role.members.some((member) => member.type === "user" && member.id === userId),
  );
}
