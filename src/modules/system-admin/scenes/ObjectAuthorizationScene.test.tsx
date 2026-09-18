/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const capability = vi.hoisted((): { current: string } => ({ current: "available" }));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    runtimeConfig: {
      currentUser: { id: "u-admin", permissions: ["admin-authz:grant", "admin-authz:revoke"] },
    },
  }),
}));
vi.mock("@/framework/entitlement/use-entitlement", () => ({
  useCapability: () => capability.current,
}));
vi.mock("@/modules/system-admin/components/TopResourceAuthorizationPanel", () => ({
  TopResourceAuthorizationPanel: () => <div>top-resource-workbench</div>,
}));
vi.mock("@/modules/system-admin/utils/audit-lookup-cache", () => ({
  getCachedDepartments: vi.fn(() => Promise.resolve([])),
  getCachedUserSync: vi.fn(() => undefined),
  hydrateUserLookup: vi.fn(() => Promise.resolve(undefined)),
}));
vi.mock("@/modules/system-admin/components/ObjectAuthorizeDrawer", () => ({
  ObjectAuthorizeDrawer: () => null,
}));

import { ObjectAuthorizationScene } from "./ObjectAuthorizationScene";

describe("ObjectAuthorizationScene", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capability.current = "available";
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    }));
  });

  it("organizes the resource and user workbenches as tabs after retiring the flattened permissions list", async () => {
    render(<ObjectAuthorizationScene />);
    await act(async () => {});

    expect(screen.getByText("top-resource-workbench")).not.toBeNull();
    expect(screen.getByText("systemAdmin.objectGrants.tabResource")).not.toBeNull();
    expect(screen.getByText("systemAdmin.objectGrants.tabUser")).not.toBeNull();
    expect(screen.queryByText("systemAdmin.objectGrants.tabAll")).toBeNull();
    expect(screen.queryByText("systemAdmin.objectGrants.permissionHelp")).toBeNull();
  });
});
