/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRuntimeConfig } from "@/framework/runtime/config";

describe("createRuntimeConfig", () => {
  beforeEach(() => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_USE_MOCK", "true");
    vi.stubEnv("VITE_MOCK_USER", "admin");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it.each(["admin", "viewer"])(
    "initializes the %s user without resolving the browser locale before bootstrap",
    async (role) => {
      vi.stubEnv("VITE_MOCK_USER", role);
      vi.spyOn(navigator, "languages", "get").mockReturnValue(["en-US"]);
      vi.resetModules();
      const config = await import("@/framework/runtime/config");

      expect(config.getRuntimeConfig().currentUser.roles).toEqual([role]);
      expect(config.getRuntimeConfig().locale).toBe("zh-CN");
      expect(config.createRuntimeConfig().locale).toBe("en-US");
      expect(config.createRuntimeConfig({ locale: "zh-CN" }).locale).toBe("zh-CN");
    },
  );

  it("selects a viewer independently of the licensed edition", () => {
    vi.stubEnv("VITE_MOCK_USER", "viewer");
    for (const edition of ["community", "professional", "enterprise", "industry"]) {
      vi.stubEnv("VITE_MOCK_EDITION", edition);
      const { currentUser } = createRuntimeConfig();
      expect(currentUser.name).toBe("业务只读用户");
      expect(currentUser.isSuperAdmin).toBe(false);
      expect(currentUser.permissions).toContain("knowledge-network:view");
      expect(currentUser.permissions).not.toContain("knowledge-network:create");
    }
  });

  it("keeps explicit runtime input above the mock user preset", () => {
    vi.stubEnv("VITE_MOCK_USER", "viewer");
    const currentUser = {
      id: "host-user",
      name: "Host Operator",
      isAdmin: true,
      isSuperAdmin: false,
      roles: ["operator"],
      permissions: ["catalog:modify"],
    };
    expect(createRuntimeConfig({ currentUser }).currentUser).toEqual(currentUser);
  });

  it("ignores mock user selection when using a real backend", () => {
    vi.stubEnv("VITE_MOCK_USER", "viewer");
    vi.stubEnv("VITE_USE_MOCK", "false");
    expect(createRuntimeConfig().currentUser.name).toBe("Local Admin");
  });

  it("merges runtime user permissions and theme overrides", () => {
    const runtimeConfig = createRuntimeConfig({
      currentUser: {
        name: "Operator",
        permissions: ["knowledge-network:create"],
      },
      theme: {
        primaryColor: "#123456",
      },
    });

    expect(runtimeConfig.currentUser.name).toBe("Operator");
    expect(runtimeConfig.currentUser.permissions).toEqual(["knowledge-network:create"]);
    expect(runtimeConfig.currentUser.roles).toEqual(["admin"]);
    expect(runtimeConfig.theme.primaryColor).toBe("#123456");
    expect(runtimeConfig.router.basename).toBe("/studio");
  });

  it("normalizes runtime locale input", () => {
    expect(createRuntimeConfig({ locale: "en-GB" }).locale).toBe("en-US");
    expect(createRuntimeConfig({ locale: "zh_Hans_CN" }).locale).toBe("zh-CN");
  });

  it("defaults hiddenNavigation to empty and keeps only string keys", () => {
    expect(createRuntimeConfig().hiddenNavigation).toEqual([]);
    expect(
      createRuntimeConfig({
        hiddenNavigation: ["bkn-project", 42, "functions"] as unknown as string[],
      }).hiddenNavigation,
    ).toEqual(["bkn-project", "functions"]);
    expect(
      createRuntimeConfig({ hiddenNavigation: "bkn-project" as unknown as string[] })
        .hiddenNavigation,
    ).toEqual([]);
  });
});
