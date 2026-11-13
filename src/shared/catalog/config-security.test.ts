/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";
import { protectCatalogConfigVariables } from "@/shared/catalog/config-security";

describe("Catalog sensitive variables", () => {
  it("masks declared names with internal underscores without changing the source", () => {
    const config = {
      variables: {
        token: "private-token",
        api_key: "private-key",
        client_key: "private-option",
        tenant: "public",
      },
      sensitive_variables: ["token", "api_key", "client_key"],
      options: { timeout_seconds: 30, max_response_mib: 10 },
    };
    expect(protectCatalogConfigVariables(config, "display")).toEqual({
      variables: {
        token: "••••••••",
        api_key: "••••••••",
        client_key: "••••••••",
        tenant: "public",
      },
      sensitive_variables: ["token", "api_key", "client_key"],
      options: { timeout_seconds: 30, max_response_mib: 10 },
    });
    expect(protectCatalogConfigVariables(config, "edit")).toEqual({
      variables: { tenant: "public" },
      sensitive_variables: ["token", "api_key", "client_key"],
      options: { timeout_seconds: 30, max_response_mib: 10 },
    });
    expect(config.variables.token).toBe("private-token");
    expect(config.variables.client_key).toBe("private-option");
    expect(config.variables.api_key).toBe("private-key");
  });
  it.each([
    null,
    "arbitrary",
    [42],
    ["arbitrary", "arbitrary"],
    ["variables.arbitrary"],
    ["_secret"],
    ["__paging"],
  ])("hides all variables when declaration is invalid: %j", (sensitive_variables) => {
    const config = {
      variables: { arbitrary: "private-option" },
      sensitive_variables,
      options: { encrypt: true },
    };
    expect(JSON.stringify(protectCatalogConfigVariables(config, "display"))).not.toContain(
      "private-option",
    );
    expect(protectCatalogConfigVariables(config, "edit").variables).toEqual({});
    expect(protectCatalogConfigVariables(config, "display").options).toEqual({ encrypt: true });
    expect(protectCatalogConfigVariables(config, "edit").options).toEqual({ encrypt: true });
  });
  it("leaves ordinary connector options intact when no declaration is present", () => {
    const config = { options: { encrypt: true, timeout: 30 } };
    expect(protectCatalogConfigVariables(config, "display")).toEqual(config);
    expect(protectCatalogConfigVariables(config, "edit")).toEqual(config);
  });
});
