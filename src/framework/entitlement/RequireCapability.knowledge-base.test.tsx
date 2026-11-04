/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RequireCapability } from "@/framework/entitlement/RequireCapability";
const state = vi.hoisted(() => ({
  capability: "not-installed",
  snapshot: {
    edition: "community",
    licensed: false,
    capabilities: [],
    extensions: [],
    state: "unlicensed",
    limits: {},
  },
  loading: false,
}));
vi.mock("@/framework/entitlement/use-entitlement", () => ({
  useCapability: () => state.capability,
  useEntitlementContext: () => state,
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);
describe("knowledge base capability guidance", () => {
  for (const capability of ["not-installed", "not-licensed"] as const)
    it(`${capability} explains the Professional licence without mounting the paid page`, () => {
      state.capability = capability;
      render(
        <RequireCapability capability="knowledge_base">
          <p>Paid implementation</p>
        </RequireCapability>,
      );
      expect(screen.getByText("common.entitlement.knowledgeBaseLicense.title")).toBeTruthy();
      expect(screen.queryByText("Paid implementation")).toBeNull();
    });
  it("still mounts the installed authorized implementation", () => {
    state.capability = "available";
    render(
      <RequireCapability capability="knowledge_base">
        <p>Paid implementation</p>
      </RequireCapability>,
    );
    expect(screen.getByText("Paid implementation")).toBeTruthy();
  });
  it("keeps the existing missing-page behavior for other capabilities", () => {
    state.capability = "not-installed";
    render(
      <RequireCapability capability="another_capability">
        <p>Paid implementation</p>
      </RequireCapability>,
    );
    expect(screen.getByText("common.pageNotFound")).toBeTruthy();
    expect(screen.queryByText("Paid implementation")).toBeNull();
  });
});
