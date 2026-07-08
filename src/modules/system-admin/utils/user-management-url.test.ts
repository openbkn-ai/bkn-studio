/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  applySelectedDeptId,
  applyUserManagementFilters,
  readSelectedDeptId,
  readUserManagementFilters,
  USER_MGMT_DEPT_PARAM,
  USER_MGMT_PAGE_PARAM,
  USER_MGMT_PAGE_SIZE_PARAM,
  USER_MGMT_Q_PARAM,
  USER_MGMT_ROLE_PARAM,
  USER_MGMT_STATUS_PARAM,
} from "@/modules/system-admin/utils/user-management-url";

describe("user-management-url", () => {
  it("reads dept id from search params", () => {
    const params = new URLSearchParams(`${USER_MGMT_DEPT_PARAM}=dep-data`);
    expect(readSelectedDeptId(params)).toBe("dep-data");
    expect(readSelectedDeptId(new URLSearchParams())).toBeNull();
  });

  it("applies and clears dept id", () => {
    const base = new URLSearchParams(`${USER_MGMT_PAGE_PARAM}=2`);
    const withDept = applySelectedDeptId(base, "dep-rd");
    expect(withDept.get(USER_MGMT_DEPT_PARAM)).toBe("dep-rd");
    expect(withDept.get(USER_MGMT_PAGE_PARAM)).toBe("2");

    const cleared = applySelectedDeptId(withDept, null);
    expect(cleared.get(USER_MGMT_DEPT_PARAM)).toBeNull();
    expect(cleared.get(USER_MGMT_PAGE_PARAM)).toBe("2");
  });

  it("reads and applies full user-management filters", () => {
    const params = new URLSearchParams(
      [
        `${USER_MGMT_DEPT_PARAM}=dep-rd`,
        `${USER_MGMT_Q_PARAM}=alice`,
        `${USER_MGMT_STATUS_PARAM}=enabled`,
        `${USER_MGMT_ROLE_PARAM}=role-a`,
        `${USER_MGMT_PAGE_PARAM}=3`,
        `${USER_MGMT_PAGE_SIZE_PARAM}=20`,
      ].join("&"),
    );

    expect(readUserManagementFilters(params)).toEqual({
      deptId: "dep-rd",
      keyword: "alice",
      status: "enabled",
      roleId: "role-a",
      page: 3,
      pageSize: 20,
    });

    const cleared = applyUserManagementFilters(params, {
      deptId: null,
      keyword: "",
      status: "",
      roleId: "",
      page: 1,
      pageSize: 10,
    });
    expect(cleared.toString()).toBe("");
  });
});
