/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { filterMockOperations, getMockUserRole } from "@/framework/runtime/mock-user";

describe("local mock user selection", () => {
  beforeEach(() => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_USE_MOCK", "true");
    vi.stubEnv("VITE_MOCK_USER", "viewer");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("only retains explicit read operations without mutating the fixture", () => {
    const operations = ["view_detail", "query_data", "modify", "delete", "authorize", "execute"];
    expect(filterMockOperations(operations)).toEqual(["view_detail"]);
    expect(operations).toContain("modify");
    expect(filterMockOperations(["view", "publish", "unknown"])).toEqual(["view"]);
    expect(filterMockOperations(["view_summary", "modify"])).toEqual(["view_summary"]);
    expect(filterMockOperations([])).toEqual([]);
  });

  it("expands wildcard grants to reads, never to a write grant", () => {
    expect(filterMockOperations(["*"])).toEqual(["view", "view_detail"]);
  });

  it("restores administrator operations after changing the selected role", () => {
    expect(getMockUserRole()).toBe("viewer");
    vi.stubEnv("VITE_MOCK_USER", "admin");
    const operations = ["*"];
    expect(filterMockOperations(operations)).toEqual(operations);
    expect(filterMockOperations(operations)).not.toBe(operations);
  });

  it("rejects invalid local roles instead of silently granting administrator access", () => {
    vi.stubEnv("VITE_MOCK_USER", "vewier");
    expect(() => getMockUserRole()).toThrow("VITE_MOCK_USER must be admin or viewer");
  });

  it.each(["viewer", "invalid"])("ignores %s in real-backend and production modes", (role) => {
    vi.stubEnv("VITE_MOCK_USER", role);
    vi.stubEnv("VITE_USE_MOCK", "false");
    expect(getMockUserRole()).toBe("admin");
    expect(filterMockOperations(["modify"])).toEqual(["modify"]);
    vi.stubEnv("VITE_USE_MOCK", "true");
    vi.stubEnv("DEV", false);
    expect(getMockUserRole()).toBe("admin");
  });
});
