/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { RuntimeUser } from "@/framework/runtime/types";

/** Fixed mock account data; its name is an identity value rather than translated UI copy. */
export function getMockViewerUser(): RuntimeUser {
  return {
    id: "local-mock-viewer",
    isAdmin: false,
    isSuperAdmin: false,
    name: "业务只读用户",
    // Explicit grants keep future module permissions out of the read-only persona.
    permissions: [
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
      "execution-factory:catalog:view",
    ],
    roles: ["viewer"],
  };
}

export function getMockUserRole(): "admin" | "viewer" {
  if (!import.meta.env.DEV || import.meta.env.VITE_USE_MOCK === "false") {
    return "admin";
  }

  const role: unknown = import.meta.env.VITE_MOCK_USER;
  if (!role || role === "admin") {
    return "admin";
  }
  if (role === "viewer") {
    return "viewer";
  }
  throw new Error("VITE_MOCK_USER must be admin or viewer");
}

/** Project mock grants without mutating shared fixtures or changing real-backend responses. */
export function filterMockOperations(operations: readonly string[]): string[] {
  if (getMockUserRole() !== "viewer") {
    return [...operations];
  }
  const reads = ["view", "view_detail"];
  return operations.includes("*")
    ? reads
    : operations.filter((operation) => reads.includes(operation) || operation === "view_summary");
}
