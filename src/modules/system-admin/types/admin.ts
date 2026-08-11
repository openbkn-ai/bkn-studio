/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

// Aligned with bkn-safe `/api/safe/v1/admin/*`, the unified admin API after ISF retirement.
// Note: the backend does not yet support freezing/unfreezing or writing user-to-department
// membership, so those operations are excluded from write paths pending backend support.

export type ResourceRef = {
  /** Resource instance ID; "*" represents the entire type. */
  id: string;
  type: string;
};

export type ResourceGrant = {
  operations: string[];
  resource: ResourceRef;
};

export type AdminUser = {
  account: string;
  accountType: string;
  builtin?: boolean;
  /** Department IDs for the user (many-to-many; absent from list endpoints and obtained from details or department-member lookup). */
  departmentIds?: string[];
  /** Department-name summary returned by list endpoints. */
  departmentNames?: string[];
  email: string;
  enabled: boolean;
  id: string;
  name: string;
  /** Role IDs directly bound to this user through role-bindings, excluding inherited department roles. */
  roleIds: string[];
  /** Direct-role name summary returned by list endpoints. */
  roleNames?: string[];
  telephone: string;
  updatedAt?: number;
};

export type AuditLog = {
  action: string;
  actorId: string;
  clientIp: string;
  createdAt: string;
  detail?: string;
  id: string;
  method: string;
  resource: string;
  status: number;
  targetId: string;
  targetName?: string;
};

export type AuditLogQuery = {
  action?: string;
  actorId?: string;
  failedOnly?: boolean;
  from?: string;
  limit?: number;
  offset?: number;
  resource?: string;
  targetId?: string;
  to?: string;
};

export type AdminDepartment = {
  code?: string;
  email?: string;
  id: string;
  /** Direct member count from read-only GET /departments/:id/members. */
  managerId?: string;
  managerName?: string;
  memberCount?: number;
  name: string;
  parentId: string | null;
  remark?: string;
  /** Member count including child departments, with users deduplicated. */
  subtreeMemberCount?: number;
  type: string;
};

export type RoleMemberType = "user" | "department";

export type RoleMember = {
  id: string;
  label: string;
  type: RoleMemberType;
};

export type AdminRole = {
  /** Direct member accessor ID from role-bindings; resolve its type through users/departments. */
  accessorIds: string[];
  builtin: boolean;
  description: string;
  id: string;
  name: string;
  /** Object-level grant: resource{type,id} plus operations. */
  permissions: ResourceGrant[];
  source?: string;
  updatedAt?: number;
};

export type DeptTreeEntry = {
  dept: AdminDepartment;
  depth: number;
};

export type CreateUserInput = {
  account: string;
  departmentIds: string[];
  email: string;
  name: string;
  password: string;
  roleIds: string[];
  telephone: string;
};

export type UpdateUserInput = {
  /** Replacement semantics: an array replaces the whole set, [] clears it, and omission is decided by the caller. */
  departmentIds: string[];
  email: string;
  enabled: boolean;
  name: string;
  roleIds: string[];
  telephone: string;
};

export type DepartmentInput = {
  code?: string;
  email?: string;
  managerId?: string;
  name: string;
  parentId: string | null;
  remark?: string;
  type?: string;
};

export type RoleInput = {
  description: string;
  name: string;
};

export type UserListQuery = {
  departmentId?: string;
  enabled?: boolean;
  includeSubtree?: boolean;
  limit?: number;
  offset?: number;
  roleId?: string;
  search?: string;
};
