/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultDevRuntimeUser, getDevRuntimeUser } from "@/framework/runtime/dev-profile";
import { defaultDevPermissions } from "@/framework/runtime/module-manifests";

describe("mock runtime users", () => {
  beforeEach(() => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_USE_MOCK", "true");
    vi.stubEnv("VITE_MOCK_USER", "");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("keeps the full-permission administrator as the default", () => {
    expect(getDevRuntimeUser()).toEqual(defaultDevRuntimeUser);
    expect(getDevRuntimeUser().permissions).toEqual(defaultDevPermissions);
    vi.stubEnv("VITE_MOCK_USER", "admin");
    expect(getDevRuntimeUser()).toEqual(defaultDevRuntimeUser);
  });

  it("gives the viewer explicit business read permissions and a separate identity", () => {
    vi.stubEnv("VITE_MOCK_USER", "viewer");
    const viewer = getDevRuntimeUser();
    expect(viewer.id).not.toBe(defaultDevRuntimeUser.id);
    expect(viewer).toMatchObject({
      name: "业务只读用户",
      roles: ["viewer"],
      isAdmin: false,
      isSuperAdmin: false,
    });
    expect(viewer.permissions).toEqual([
      "knowledge-network:view",
      "knowledge-network:concept-group:view",
      "knowledge-network:metric:view",
      "catalog:view_detail",
      "resource:view_detail",
      "execution-factory:toolbox:view",
      "execution-factory:function:view",
      "execution-factory:tool:view",
      "execution-factory:mcp:view",
      "execution-factory:skill:view",
    ]);
    expect(defaultDevPermissions).toEqual(expect.arrayContaining(viewer.permissions));
    // Project fixtures continue to belong to the administrator, not to the viewer.
    expect(defaultDevRuntimeUser.roles).toEqual(["admin"]);
    expect(defaultDevRuntimeUser.isSuperAdmin).toBe(true);
  });

  it("does not share mutable permission or role arrays between callers", () => {
    vi.stubEnv("VITE_MOCK_USER", "viewer");
    const user = getDevRuntimeUser();
    user.permissions.push("admin-user:delete");
    user.roles.push("admin");
    expect(getDevRuntimeUser().permissions).not.toContain("admin-user:delete");
    expect(getDevRuntimeUser().roles).toEqual(["viewer"]);
  });
});
