/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.hoisted(() => vi.fn());

vi.mock("@/modules/system-admin/services/admin.service", () => ({
  getUser,
  listDepartments: vi.fn(),
  listRoles: vi.fn(),
}));

import {
  MAX_CONCURRENT_USER_LOOKUPS,
  getCachedUser,
  hydrateUserLookup,
  hydrateUserLookupDetails,
  isDeletedUserSync,
  isUserLookupId,
} from "@/modules/system-admin/utils/audit-lookup-cache";

describe("audit user lookup", () => {
  beforeEach(() => {
    getUser.mockReset();
  });

  it("does not resolve synthetic system actors as users", async () => {
    expect(isUserLookupId("system:license")).toBe(false);
    expect(await getCachedUser("system:license")).toBeNull();

    await hydrateUserLookup(["system:license", "u-1"]);

    expect(getUser).toHaveBeenCalledTimes(1);
    expect(getUser).toHaveBeenCalledWith("u-1", { skipErrorToast: true });
  });

  it("distinguishes deleted users from temporary lookup failures", async () => {
    getUser.mockImplementation((id: string) => {
      if (id === "u-deleted") {
        return Promise.reject(Object.assign(new Error("user not found"), {
          isAxiosError: true,
          response: { status: 404 },
        }));
      }
      return Promise.reject(Object.assign(new Error("directory unavailable"), {
        isAxiosError: true,
        response: { status: 503 },
      }));
    });

    await expect(hydrateUserLookupDetails(["u-deleted", "u-unavailable"]))
      .resolves.toEqual({
        deleted: ["u-deleted"],
        unavailable: ["u-unavailable"],
      });
    expect(isDeletedUserSync("u-deleted")).toBe(true);
    expect(isDeletedUserSync("u-unavailable")).toBe(false);
  });

  it("limits concurrent directory lookups while resolving every distinct user", async () => {
    const resolvers: Array<() => void> = [];
    getUser.mockImplementation((id: string) => new Promise((resolve) => {
      resolvers.push(() => resolve({ id }));
    }));
    const ids = Array.from(
      { length: MAX_CONCURRENT_USER_LOOKUPS + 2 },
      (_value, index) => `u-limit-${index}`,
    );
    const lookup = hydrateUserLookupDetails(ids);

    await vi.waitFor(() => {
      expect(getUser).toHaveBeenCalledTimes(MAX_CONCURRENT_USER_LOOKUPS);
    });
    resolvers.shift()?.();
    await vi.waitFor(() => {
      expect(getUser).toHaveBeenCalledTimes(MAX_CONCURRENT_USER_LOOKUPS + 1);
    });
    resolvers.shift()?.();
    await vi.waitFor(() => {
      expect(getUser).toHaveBeenCalledTimes(ids.length);
    });
    while (resolvers.length) {
      resolvers.shift()?.();
    }

    await expect(lookup).resolves.toEqual({ deleted: [], unavailable: [] });
    expect(getUser).toHaveBeenCalledTimes(ids.length);
  });

  it("drops queued lookups when their page is no longer interested", async () => {
    const resolvers: Array<() => void> = [];
    getUser.mockImplementation((id: string) => new Promise((resolve) => {
      resolvers.push(() => resolve({ id }));
    }));
    const controller = new AbortController();
    const ids = Array.from(
      { length: MAX_CONCURRENT_USER_LOOKUPS + 1 },
      (_value, index) => `u-cancel-${index}`,
    );
    const lookup = hydrateUserLookupDetails(ids, { signal: controller.signal });

    await vi.waitFor(() => {
      expect(getUser).toHaveBeenCalledTimes(MAX_CONCURRENT_USER_LOOKUPS);
    });
    controller.abort();
    await expect(lookup).resolves.toEqual({ deleted: [], unavailable: ids });
    while (resolvers.length) {
      resolvers.shift()?.();
    }
    await vi.waitFor(() => {
      expect(getUser).toHaveBeenCalledTimes(MAX_CONCURRENT_USER_LOOKUPS);
    });
  });
});
