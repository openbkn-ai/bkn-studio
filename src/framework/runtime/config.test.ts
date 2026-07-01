/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { createRuntimeConfig } from "@/framework/runtime/config";

describe("createRuntimeConfig", () => {
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
});
