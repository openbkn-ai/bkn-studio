/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EntitlementView } from "@/framework/entitlement/types";
import { KnowledgeBaseLicensePage } from "@/framework/entitlement/KnowledgeBaseLicensePage";

const state = vi.hoisted(() => ({
  snapshot: null as EntitlementView | null,
  loading: false,
  navigate: vi.fn(),
}));
vi.mock("@/framework/entitlement/use-entitlement", () => ({ useEntitlementContext: () => state }));
vi.mock("react-router-dom", () => ({ useNavigate: () => state.navigate }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);
describe("KnowledgeBaseLicensePage", () => {
  for (const edition of ["community", "professional", "enterprise"] as const) {
    it(`${edition} explains the licence or enablement without mounting a paid implementation`, () => {
      state.snapshot = {
        edition,
        licensed: edition !== "community",
        state: edition === "community" ? "unlicensed" : "valid",
        capabilities: [],
        extensions: [],
        limits: {},
      };
      render(<KnowledgeBaseLicensePage />);
      expect(
        screen.getByText(
          `common.entitlement.knowledgeBaseLicense.${edition === "community" ? "title" : "enableTitle"}`,
        ),
      ).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "subscription.title" }));
      expect(state.navigate).toHaveBeenCalledWith("/system/subscription");
    });
  }
  it("does not assert a missing licence when entitlement lookup failed", () => {
    state.snapshot = null;
    state.loading = false;
    render(<KnowledgeBaseLicensePage />);
    expect(screen.getByText("common.entitlement.unknownTitle")).toBeTruthy();
    expect(screen.queryByText("common.entitlement.knowledgeBaseLicense.title")).toBeNull();
  });
});
