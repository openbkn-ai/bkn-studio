/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EntitlementContext } from "@/framework/entitlement/entitlement-context";
import { LicenseStateBanner } from "@/framework/entitlement/LicenseStateBanner";
import type { Entitlement } from "@/framework/entitlement/types";

vi.mock("react-i18next", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-i18next")>();
  return { ...original, useTranslation: () => ({ t: (key: string) => key }) };
});

function renderBanner(snapshot: Entitlement | null) {
  render(
    <EntitlementContext.Provider value={{ loading: false, refresh: async () => {}, snapshot }}>
      <LicenseStateBanner />
    </EntitlementContext.Provider>,
  );
}

const unlicensed: Entitlement = {
  capabilities: [],
  edition: "community",
  extensions: [],
  features: [],
  licensed: false,
  limits: {},
  state: "unlicensed",
};

describe("LicenseStateBanner", () => {
  it("prompts registration after the no-license trial ends and cannot be dismissed", () => {
    renderBanner(unlicensed);

    expect(screen.getByText("common.entitlement.banner.unlicensed")).toBeTruthy();
    expect(screen.getByRole("link", { name: "common.entitlement.banner.action" })).toHaveAttribute(
      "href",
      "https://license.openbkn.ai/register",
    );
    expect(screen.queryByRole("button", { name: /close/i })).toBeNull();
  });

  it.each(["trial", "fallback_community", "invalid", "valid"] as const)(
    "does not ask users to register for %s",
    (state) => {
      renderBanner({ ...unlicensed, licensed: state === "valid", state });

      expect(screen.queryByText("common.entitlement.banner.unlicensed")).toBeNull();
    },
  );

  it("stays hidden until the authorization status loads", () => {
    renderBanner(null);

    expect(screen.queryByText("common.entitlement.banner.unlicensed")).toBeNull();
  });
});
