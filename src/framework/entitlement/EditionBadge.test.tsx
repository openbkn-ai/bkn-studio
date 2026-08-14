/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EditionBadge } from "@/framework/entitlement/EditionBadge";
import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import type { Entitlement } from "@/framework/entitlement/types";

const contextState = vi.hoisted(() => ({ snapshot: null as Entitlement | null }));

vi.mock("@/framework/entitlement/use-entitlement", () => ({
  useEntitlementContext: () => contextState,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function entitlement(overrides: Partial<Entitlement> = {}): Entitlement {
  return {
    capabilities: [],
    edition: "community",
    extensions: [],
    features: [],
    licensed: false,
    limits: {},
    state: "unlicensed",
    ...overrides,
  };
}

beforeEach(() => {
  contextState.snapshot = null;
});

describe("EditionBadge", () => {
  it("hides a reported capability badge when the capability is available", () => {
    contextState.snapshot = entitlement({
      capabilities: [CAPABILITIES.RBAC_BASIC],
      edition: "professional",
      extensions: [CAPABILITIES.RBAC_BASIC],
      licensed: true,
      state: "valid",
    });

    render(<EditionBadge capability={CAPABILITIES.RBAC_BASIC} edition="professional" />);

    expect(screen.queryByText("common.entitlement.editionsShort.professional")).toBeNull();
  });

  it("keeps the badge when the reported capability is unavailable", () => {
    contextState.snapshot = entitlement({
      edition: "professional",
      extensions: [CAPABILITIES.RBAC_BASIC],
      licensed: true,
      state: "valid",
    });

    render(<EditionBadge capability={CAPABILITIES.RBAC_BASIC} edition="professional" />);

    expect(screen.getByText("common.entitlement.editionsShort.professional")).toBeTruthy();
  });

  it("keeps the badge while the entitlement snapshot is unknown", () => {
    render(<EditionBadge capability={CAPABILITIES.RBAC_BASIC} edition="professional" />);

    expect(screen.getByText("common.entitlement.editionsShort.professional")).toBeTruthy();
  });
});
