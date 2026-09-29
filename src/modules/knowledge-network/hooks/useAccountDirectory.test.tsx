/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  listUsers: vi.fn(),
  permissions: [] as string[],
}));

vi.mock("@/framework/context/use-runtime-config", () => ({
  useRuntimeConfig: () => ({ currentUser: { permissions: mocks.permissions } }),
}));

vi.mock("@/modules/system-admin/services/admin.service", () => ({
  getUser: mocks.getUser,
  listUsers: mocks.listUsers,
}));

import {
  resolveUpdaterDisplayName,
  useAccountDirectory,
  useResolvedUpdaterName,
} from "./useAccountDirectory";

const userId = "266c6a42-6131-4d62-8f39-853e7093701c";

describe("knowledge-network account directory", () => {
  beforeEach(() => {
    mocks.permissions = [];
    mocks.getUser.mockReset();
    mocks.listUsers.mockReset();
  });

  it("does not request the administrator user directory without user-management permission", () => {
    const { result } = renderHook(() => useAccountDirectory());

    expect(result.current.size).toBe(0);
    expect(mocks.listUsers).not.toHaveBeenCalled();
  });

  it("loads the directory only for a user-management administrator", async () => {
    mocks.permissions = ["admin-user:view"];
    mocks.listUsers.mockResolvedValue([{ id: userId, name: "Alice Zhang" }]);

    const { result } = renderHook(() => useAccountDirectory());

    await waitFor(() => {
      expect(result.current.get(userId)).toBe("Alice Zhang");
    });
    expect(mocks.listUsers).toHaveBeenCalledWith({ skipErrorToast: true });
  });

  it("keeps a readable updater value without consulting the administrator API", () => {
    const { result } = renderHook(() => useResolvedUpdaterName("alice.zhang"));

    expect(result.current).toBe("alice.zhang");
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.listUsers).not.toHaveBeenCalled();
  });

  it("resolves a UUID through a silent detail request when permission allows it", async () => {
    mocks.permissions = ["admin-user:view"];
    mocks.listUsers.mockResolvedValue([]);
    mocks.getUser.mockResolvedValue({ name: "Alice Zhang" });

    const { result } = renderHook(() => useResolvedUpdaterName(userId));

    await waitFor(() => {
      expect(result.current).toBe("Alice Zhang");
    });
    expect(mocks.getUser).toHaveBeenCalledWith(userId, { skipErrorToast: true });
  });

  it("does not expose an unresolved UUID to a non-administrator", () => {
    expect(resolveUpdaterDisplayName(userId, new Map())).toBe("--");

    const { result } = renderHook(() => useResolvedUpdaterName(userId));

    expect(result.current).toBe("--");
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.listUsers).not.toHaveBeenCalled();
  });
});
