/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const USER_MGMT_DEPT_PARAM = "dept";
export const USER_MGMT_Q_PARAM = "q";
export const USER_MGMT_STATUS_PARAM = "status";
export const USER_MGMT_ROLE_PARAM = "role";
export const USER_MGMT_PAGE_PARAM = "page";
export const USER_MGMT_PAGE_SIZE_PARAM = "pageSize";

export type UserManagementStatusFilter = "" | "enabled" | "disabled";

export type UserManagementFilters = {
  deptId: string | null;
  keyword: string;
  page: number;
  pageSize: number;
  roleId: string;
  status: UserManagementStatusFilter;
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const ALLOWED_PAGE_SIZES = new Set([10, 20, 50, 100]);

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseStatus(value: string | null): UserManagementStatusFilter {
  if (value === "enabled" || value === "disabled") {
    return value;
  }
  return "";
}

export function readUserManagementFilters(params: URLSearchParams): UserManagementFilters {
  const pageSizeRaw = parsePositiveInt(params.get(USER_MGMT_PAGE_SIZE_PARAM), DEFAULT_PAGE_SIZE);
  return {
    deptId: params.get(USER_MGMT_DEPT_PARAM)?.trim() || null,
    keyword: params.get(USER_MGMT_Q_PARAM)?.trim() ?? "",
    page: parsePositiveInt(params.get(USER_MGMT_PAGE_PARAM), DEFAULT_PAGE),
    pageSize: ALLOWED_PAGE_SIZES.has(pageSizeRaw) ? pageSizeRaw : DEFAULT_PAGE_SIZE,
    roleId: params.get(USER_MGMT_ROLE_PARAM)?.trim() ?? "",
    status: parseStatus(params.get(USER_MGMT_STATUS_PARAM)),
  };
}

export function applyUserManagementFilters(
  base: URLSearchParams,
  filters: UserManagementFilters,
): URLSearchParams {
  const next = new URLSearchParams(base);

  if (filters.deptId) {
    next.set(USER_MGMT_DEPT_PARAM, filters.deptId);
  } else {
    next.delete(USER_MGMT_DEPT_PARAM);
  }

  if (filters.keyword) {
    next.set(USER_MGMT_Q_PARAM, filters.keyword);
  } else {
    next.delete(USER_MGMT_Q_PARAM);
  }

  if (filters.status) {
    next.set(USER_MGMT_STATUS_PARAM, filters.status);
  } else {
    next.delete(USER_MGMT_STATUS_PARAM);
  }

  if (filters.roleId) {
    next.set(USER_MGMT_ROLE_PARAM, filters.roleId);
  } else {
    next.delete(USER_MGMT_ROLE_PARAM);
  }

  if (filters.page > DEFAULT_PAGE) {
    next.set(USER_MGMT_PAGE_PARAM, String(filters.page));
  } else {
    next.delete(USER_MGMT_PAGE_PARAM);
  }

  if (filters.pageSize !== DEFAULT_PAGE_SIZE) {
    next.set(USER_MGMT_PAGE_SIZE_PARAM, String(filters.pageSize));
  } else {
    next.delete(USER_MGMT_PAGE_SIZE_PARAM);
  }

  return next;
}

export function readSelectedDeptId(params: URLSearchParams): string | null {
  return readUserManagementFilters(params).deptId;
}

export function applySelectedDeptId(
  base: URLSearchParams,
  deptId: string | null,
): URLSearchParams {
  return applyUserManagementFilters(base, {
    ...readUserManagementFilters(base),
    deptId,
  });
}
