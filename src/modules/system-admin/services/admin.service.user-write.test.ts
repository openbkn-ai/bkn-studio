/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteMock = vi.hoisted(() => vi.fn());
const getMock = vi.hoisted(() => vi.fn());
const postMock = vi.hoisted(() => vi.fn());
const putMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { delete: deleteMock, get: getMock, post: postMock, put: putMock },
}));

import { listRoles, updateUser } from "@/modules/system-admin/services/admin.service";

describe("admin.service · updateUser", () => {
  beforeEach(() => {
    deleteMock.mockReset();
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
    putMock.mockResolvedValue({});
  });

  it("updates user fields without changing existing role bindings", async () => {
    await updateUser("u-chen", {
      name: "Updated user",
      email: "updated@example.com",
      telephone: "123456",
      enabled: true,
      departmentIds: ["dept-1"],
    });

    const roles = await listRoles({ withMembers: true });
    const normalUser = roles.find((role) => role.name === "normal_user");

    expect(normalUser?.accessorIds).toContain("u-chen");
    expect(getMock).not.toHaveBeenCalled();
    expect(postMock).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
    expect(putMock).not.toHaveBeenCalled();
  });
});
