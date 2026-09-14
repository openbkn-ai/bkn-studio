/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { shouldAlwaysShowEditionBadge } from "@/app/shell/navigation/edition-badge";
import { CAPABILITIES } from "@/framework/entitlement/capabilities";

describe("shouldAlwaysShowEditionBadge", () => {
  it("lets a known capability hide its paid badge once the entitlement is available", () => {
    expect(
      shouldAlwaysShowEditionBadge({ paidCapability: CAPABILITIES.RBAC_BASIC }),
    ).toBe(false);
  });

  it("keeps a static product badge when no capability state is available", () => {
    expect(shouldAlwaysShowEditionBadge({})).toBe(true);
  });

  it("keeps the badge for capabilities that are not reported by bkn-safe", () => {
    expect(
      shouldAlwaysShowEditionBadge({ paidCapability: CAPABILITIES.BUSINESS_PROVENANCE }),
    ).toBe(true);
  });
});
