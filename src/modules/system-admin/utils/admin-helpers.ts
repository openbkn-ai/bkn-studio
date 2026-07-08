/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  AdminDepartment,
  AdminRole,
  DepartmentInput,
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

export function childDepartments(
  departments: AdminDepartment[],
  parentId: string,
): AdminDepartment[] {
  return departments.filter((item) => item.parentId === parentId);
}

/** 各部门含子部门的成员数（用户去重）。 */
export function computeSubtreeMemberCounts(
  departments: AdminDepartment[],
  users: { departmentIds?: string[]; id: string }[],
): Map<string, number> {
  const childrenOf = new Map<string, string[]>();
  for (const dept of departments) {
    if (dept.parentId) {
      const siblings = childrenOf.get(dept.parentId) ?? [];
      siblings.push(dept.id);
      childrenOf.set(dept.parentId, siblings);
    }
  }
  const subtreeIds = new Map<string, string[]>();
  const collectSubtree = (id: string): string[] => {
    const cached = subtreeIds.get(id);
    if (cached) {
      return cached;
    }
    const ids = [id];
    for (const child of childrenOf.get(id) ?? []) {
      ids.push(...collectSubtree(child));
    }
    subtreeIds.set(id, ids);
    return ids;
  };
  for (const dept of departments) {
    collectSubtree(dept.id);
  }
  const usersByDept = new Map<string, Set<string>>();
  for (const user of users) {
    for (const deptId of user.departmentIds ?? []) {
      let bucket = usersByDept.get(deptId);
      if (!bucket) {
        bucket = new Set();
        usersByDept.set(deptId, bucket);
      }
      bucket.add(user.id);
    }
  }
  const out = new Map<string, number>();
  for (const dept of departments) {
    const unique = new Set<string>();
    for (const deptId of subtreeIds.get(dept.id) ?? [dept.id]) {
      for (const userId of usersByDept.get(deptId) ?? []) {
        unique.add(userId);
      }
    }
    out.set(dept.id, unique.size);
  }
  return out;
}

/** 从部门实体构造写请求（拖拽改上级等场景保留扩展字段）。 */
export function departmentInputFrom(dept: AdminDepartment): DepartmentInput {
  return {
    name: dept.name,
    parentId: dept.parentId,
    type: dept.type,
    managerId: dept.managerId ?? "",
    code: dept.code ?? "",
    email: dept.email ?? "",
    remark: dept.remark ?? "",
  };
}

/** 直接绑定到该用户的角色（role-bindings；不含部门继承）。 */
export function rolesOfUser(roles: AdminRole[], userId: string): AdminRole[] {
  return roles.filter((role) => role.accessorIds.includes(userId));
}
