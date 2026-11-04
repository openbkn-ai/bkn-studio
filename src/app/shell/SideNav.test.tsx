/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { cleanup, render, screen, within } from "@testing-library/react";

import { SideNav } from "@/app/shell/SideNav";
import { dataCatalogNavigation } from "@/modules/data-catalog/navigation";
import type { EntitlementView } from "@/framework/entitlement/types";

import { shouldAlwaysShowEditionBadge } from "@/app/shell/navigation/edition-badge";
import { CAPABILITIES } from "@/framework/entitlement/capabilities";

describe("shouldAlwaysShowEditionBadge", () => {
  it("lets a known capability hide its paid badge once the entitlement is available", () => {
    expect(shouldAlwaysShowEditionBadge({ paidCapability: CAPABILITIES.RBAC_BASIC })).toBe(false);
  });

  it("keeps a static product badge when no capability state is available", () => {
    expect(shouldAlwaysShowEditionBadge({})).toBe(true);
  });

  it("keeps the badge for capabilities that are not reported by bkn-safe", () => {
    expect(shouldAlwaysShowEditionBadge({ paidCapability: CAPABILITIES.BUSINESS_PROVENANCE })).toBe(
      true,
    );
  });
});

const badgeState = vi.hoisted(() => ({ snapshot: null as EntitlementView | null, chinese: false }));
vi.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: "/knowledge-base" }),
  useMatches: () => [],
  useNavigate: () => vi.fn(),
}));
vi.mock("@/framework/entitlement/use-entitlement", () => ({
  useEntitlement: () => badgeState.snapshot,
  useEntitlementContext: () => badgeState,
}));
vi.mock("@/app/shell/navigation/use-console-navigation", () => ({
  useConsoleNavigation: () => [
    {
      key: "general-business-knowledge-network",
      labelKey: "group",
      children: dataCatalogNavigation.items,
    },
  ],
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === "shell.items.knowledgeBase")
        return badgeState.chinese ? "知识库" : "Knowledge base";
      if (key === "shell.stage.beta") return "Beta";
      if (key === "common.entitlement.editionsShort.professional")
        return badgeState.chinese ? "专业版" : "Pro";
      return key;
    },
  }),
}));
afterEach(cleanup);
describe("knowledge base sidebar labels", () => {
  for (const chinese of [false, true])
    for (const edition of ["community", "professional", "enterprise"] as const) {
      it(`${chinese ? "Chinese" : "English"} ${edition} keeps Beta and shows Pro only when a licence is needed`, () => {
        badgeState.chinese = chinese;
        badgeState.snapshot = {
          edition,
          licensed: edition !== "community",
          state: edition === "community" ? "unlicensed" : "valid",
          capabilities: [],
          extensions: [],
          limits: {},
        };
        render(<SideNav collapsed={false} onToggleCollapsed={() => {}} />);
        const button = screen.getByRole("button", {
          name: chinese ? /^知识库/ : /^Knowledge base/,
        });
        expect(within(button).getByText("Beta")).toBeTruthy();
        expect(Boolean(within(button).queryByText(chinese ? "专业版" : "Pro"))).toBe(
          edition === "community",
        );
      });
    }
});
