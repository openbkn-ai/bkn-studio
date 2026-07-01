/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

// 对齐 bkn-safe `/api/safe/v1/admin/*`(ISF 退役后的统一 admin API)。
// 注意：冻结/解冻、部门扩展字段(负责人/编码/邮箱/备注)、用户↔部门归属写入
// 三项后端暂不支持，已从写路径剔除，等后端反馈再补。

export type ResourceRef = {
  /** 资源实例 id；"*" 表示整类。 */
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
  /** 用户所属部门 id（多对多；列表接口不返，详情/部门成员反查得到）。 */
  departmentIds?: string[];
  email: string;
  enabled: boolean;
  id: string;
  name: string;
  /** 直接绑定到该用户的角色 id（role-bindings，不含部门继承）。 */
  roleIds: string[];
  telephone: string;
  updatedAt?: number;
};

export type AuditLog = {
  action: string;
  actorId: string;
  clientIp: string;
  createdAt: string;
  id: string;
  method: string;
  resource: string;
  status: number;
  targetId: string;
};

export type AuditLogQuery = {
  action?: string;
  actorId?: string;
  failedOnly?: boolean;
  from?: string;
  limit?: number;
  offset?: number;
  resource?: string;
  to?: string;
};

export type AdminDepartment = {
  id: string;
  /** 直接成员数（GET /departments/:id/members，只读）。 */
  memberCount?: number;
  name: string;
  parentId: string | null;
  type: string;
};

export type RoleMemberType = "user" | "department";

export type RoleMember = {
  id: string;
  label: string;
  type: RoleMemberType;
};

export type AdminRole = {
  /** 直接成员 accessor id（role-bindings；类型由 users/departments 反查）。 */
  accessorIds: string[];
  builtin: boolean;
  description: string;
  id: string;
  name: string;
  /** 对象级授权（resource{type,id} + operations）。 */
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
  /** 留空 = 平台默认密码(openbkn)，首登强制改。 */
  password?: string;
  roleIds: string[];
  telephone: string;
};

export type UpdateUserInput = {
  /** 替换语义：传数组=整组替换，[]=清空，不传由调用方决定。 */
  departmentIds: string[];
  email: string;
  enabled: boolean;
  name: string;
  roleIds: string[];
  telephone: string;
};

export type DepartmentInput = {
  name: string;
  parentId: string | null;
  type?: string;
};

export type RoleInput = {
  description: string;
  name: string;
};
