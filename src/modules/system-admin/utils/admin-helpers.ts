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

/** Flattens a department tree with nesting depth for indented rendering and selection controls. */
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

/** Path from root to the target department, for example "BKN Platform / Data Intelligence / Data Governance". */
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

/** Member count for each department including child departments, with users deduplicated. */
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

/** Builds a write request from a department entity while retaining extension fields for cases such as drag-and-drop reparenting. */
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

/** Roles directly bound to this user through role-bindings, excluding department inheritance. */
export function rolesOfUser(roles: AdminRole[], userId: string): AdminRole[] {
  return roles.filter((role) => role.accessorIds.includes(userId));
}
