/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bknProjectLicenseRoutes } from "@/app/router/bkn-project-license-routes";
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

function open(path: string) {
  const router = createMemoryRouter([{ path: "/", children: bknProjectLicenseRoutes() }], {
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

describe("project management without the enterprise image", () => {
  it("masks every project path with the upgrade card in the community edition", () => {
    contextState.snapshot = entitlement({});
    for (const path of ["/bkn-project", "/bkn-project/p1/model"]) {
      const { container, unmount } = open(path);
      expect(screen.getByText("common.entitlement.unlockTitle")).toBeTruthy();
      expect(screen.getByText("subscription.capabilities.bkn_project.name")).toBeTruthy();
      // The preview stays behind the mask, out of reach.
      const preview = container.querySelector(".console-upgrade-locked-content");
      expect(preview?.getAttribute("aria-hidden")).toBe("true");
      expect(preview?.textContent).toContain("shell.items.bknProject");
      unmount();
    }
  });

  it("says the images are missing when a Professional licence is there but the service is not", () => {
    contextState.snapshot = entitlement({
      edition: "professional",
      licensed: true,
      state: "valid",
    });
    open("/bkn-project");
    expect(screen.queryByText("common.entitlement.unlockTitle")).toBeNull();
    expect(screen.getByText("common.entitlement.imageMissingTitle")).toBeTruthy();
  });

  it("leaves the paths to the enterprise pages once they are installed", () => {
    registerExtension({
      id: "bkn-project",
      capability: CAPABILITIES.BKN_PROJECT,
      routes: [{ path: "bkn-project", element: <p>projects</p> }],
    });
    expect(bknProjectLicenseRoutes()).toEqual([]);
  });
});
