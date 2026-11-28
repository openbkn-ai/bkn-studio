/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAppRouter } from "@/app/router/create-router";
import { DEFAULT_APP_ENTRY_PATH } from "@/app/router/app-paths";
import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import type { Entitlement } from "@/framework/entitlement/types";
import { registerExtension, resetExtensionsForTesting } from "@/framework/extension/registry";

const contextState = vi.hoisted(() => ({
  loading: false,
  snapshot: null as Entitlement | null,
}));

vi.mock("@/framework/entitlement/use-entitlement", () => ({
  useEntitlementContext: () => contextState,
}));

vi.mock("react-i18next", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-i18next")>();
  return { ...original, useTranslation: () => ({ t: (key: string) => key }) };
});

function entitlement(overrides: Partial<Entitlement>): Entitlement {
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

/** The community fallback exactly as the app router mounts it under the console shell. */
function open(path: string) {
  const shell = createAppRouter().routes.find((route) => route.path === DEFAULT_APP_ENTRY_PATH);
  const fallback = shell?.children?.filter((route) => route.path === "knowledge-base/*") ?? [];
  const router = createMemoryRouter([{ path: "/", children: fallback }], {
    initialEntries: [path],
  });
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  contextState.loading = false;
  contextState.snapshot = null;
});

afterEach(() => {
  resetExtensionsForTesting();
});

describe("knowledge base without the enterprise image", () => {
  it("masks the entry and deep links with the same upgrade card as project management", () => {
    contextState.snapshot = entitlement({});
    for (const path of ["/knowledge-base", "/knowledge-base/kb1"]) {
      const { container, unmount } = open(path);
      expect(screen.getByText("common.entitlement.unlockTitle")).toBeTruthy();
      expect(screen.getByText("common.entitlement.upgradeTo")).toBeTruthy();
      expect(screen.getByText("subscription.capabilities.knowledge_base.name")).toBeTruthy();
      expect(screen.queryByText("common.entitlement.knowledgeBaseLicense.title")).toBeNull();
      // The preview stays behind the mask, out of reach.
      const preview = container.querySelector(".console-upgrade-locked-content");
      expect(preview?.getAttribute("aria-hidden")).toBe("true");
      expect(preview?.textContent).toContain("shell.items.knowledgeBase");
      unmount();
    }
  });

  it("says the images are missing when a Professional licence is there but the service is not", () => {
    contextState.snapshot = entitlement({
      edition: "professional",
      licensed: true,
      state: "valid",
    });
    const { container } = open("/knowledge-base");
    expect(screen.queryByText("common.entitlement.unlockTitle")).toBeNull();
    expect(screen.getByText("common.entitlement.imageMissingTitle")).toBeTruthy();
    expect(container.querySelector(".console-upgrade-mask")).toBeTruthy();
  });

  it("leaves the paths to the enterprise pages once they are installed", () => {
    registerExtension({
      id: "knowledge-base",
      capability: CAPABILITIES.KNOWLEDGE_BASE,
      routes: [{ path: "knowledge-base", element: <p>knowledge bases</p> }],
    });
    const shell = createAppRouter().routes.find((route) => route.path === DEFAULT_APP_ENTRY_PATH);
    expect(shell?.children?.some((route) => route.path === "knowledge-base/*")).toBe(false);
  });
});
