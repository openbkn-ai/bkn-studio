export type AdminDepartment = {
  code: string;
  email: string;
  enabled: boolean;
  id: string;
  managerId: string | null;
  name: string;
  parentId: string | null;
  remark: string;
};

export type AdminUser = {
  account: string;
  builtin?: boolean;
  deptIds: string[];
  email: string;
  enabled: boolean;
  frozen: boolean;
  id: string;
  name: string;
  position: string;
  remark: string;
  updatedAt: number;
};

export type AdminPermission = {
  group: string;
  key: string;
  label: string;
};

export type RoleMemberType = "user" | "department";

export type RoleMember = {
  id: string;
  type: RoleMemberType;
};

export type AdminRole = {
  builtin: boolean;
  description: string;
  displayName: string;
  id: string;
  members: RoleMember[];
  name: string;
  permissions: string[];
  updatedAt: number;
};

export type CreateUserInput = {
  account: string;
  deptIds: string[];
  email: string;
  name: string;
  position: string;
  remark: string;
  roleIds: string[];
};

export type UpdateUserInput = {
  deptIds: string[];
  email: string;
  name: string;
  position: string;
  remark: string;
  roleIds: string[];
};

export type DepartmentInput = {
  code: string;
  email?: string;
  managerId: string | null;
  name: string;
  parentId: string | null;
  remark: string;
};

export type RoleInput = {
  description: string;
  displayName: string;
  name: string;
  permissions: string[];
};

export type DeptTreeEntry = {
  dept: AdminDepartment;
  depth: number;
};
