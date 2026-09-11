/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GrantRecord, ObjectGrant } from "@/modules/system-admin/types/authz";

const mocks = vi.hoisted(() => ({
  getCachedUserSync: vi.fn(),
  listObjectGrantsForObject: vi.fn(),
  listUsersPage: vi.fn(),
  revokeObjectGrantForObject: vi.fn(),
  upsertObjectGrantForObject: vi.fn(),
  useCapability: vi.fn(),
}));
const appServices = vi.hoisted(() => ({
  message: { error: vi.fn(), success: vi.fn() },
  modal: { confirm: vi.fn() },
  runtimeConfig: {
    currentUser: { id: "u-admin", permissions: ["admin-authz:grant", "admin-authz:revoke"] },
  },
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      key === "systemAdmin.objectGrants.selectedOperationCount"
        ? `${key}:${String(options?.selected)}/${String(options?.total)}`
        : key,
  }),
}));
vi.mock("@/framework/context/use-app-services", () => ({ useAppServices: () => appServices }));
vi.mock("@/framework/entitlement/use-entitlement", () => ({
  useCapability: mocks.useCapability,
}));
vi.mock("@/framework/entitlement/RequireEdition", () => ({
  RequireEdition: ({ children }: { children: ReactNode }) =>
    mocks.useCapability() === "available" ? children : <div>professional-edition-gate</div>,
}));
vi.mock("@/modules/system-admin/services/admin.service", () => ({
  listUsersPage: mocks.listUsersPage,
}));
vi.mock("@/modules/system-admin/services/authz.service", () => ({
  listEnterpriseObjectGrants: vi.fn(() => Promise.resolve([])),
  listObjectGrantsForObject: mocks.listObjectGrantsForObject,
  revokeObjectGrantForObject: mocks.revokeObjectGrantForObject,
  upsertObjectGrantForObject: mocks.upsertObjectGrantForObject,
}));
vi.mock("@/modules/system-admin/utils/audit-lookup-cache", () => ({
  getCachedDepartments: vi.fn(() => Promise.resolve([])),
  getCachedUserSync: mocks.getCachedUserSync,
  hydrateUserLookup: vi.fn(() => Promise.resolve(undefined)),
  primeUserLookupCache: vi.fn(),
}));

import { ObjectAuthorizeDrawer } from "./ObjectAuthorizeDrawer";

function source(overrides: Partial<GrantRecord>): GrantRecord {
  return {
    active: true,
    accessorId: "u-mate",
    authoritySource: "admin_authz",
    effect: "allow",
    grantId: "grant-direct-view",
    inherited: false,
    operation: "view_detail",
    policySource: "professional_rule",
    ...overrides,
  };
}

function grant(records: GrantRecord[], overrides: Partial<ObjectGrant> = {}): ObjectGrant {
  const operations = [...new Set(records
    .filter((record) => record.active && record.effect === "allow")
    .map((record) => record.operation))];
  return {
    accessorId: "u-mate",
    effectiveDecisions: operations.map((operation) => ({
      basis: "direct",
      decision: "allow",
      operation,
      requires: [],
    })),
    grants: records,
    objId: "catalog-1",
    objName: "Customer catalog",
    objType: "catalog",
    operations,
    ...overrides,
  };
}

function rowDeleteButton(accessorId: string) {
  const row = screen.getByText(accessorId).closest("tr");
  if (!row) {
    throw new Error(`Unable to find the grant row for ${accessorId}`);
  }
  return within(row)
    .getByText("systemAdmin.objectGrants.deleteGrant")
    .closest("button") as HTMLButtonElement;
}

describe("ObjectAuthorizeDrawer source records", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useCapability.mockReturnValue("available");
    mocks.getCachedUserSync.mockReturnValue(undefined);
    appServices.runtimeConfig.currentUser.id = "u-admin";
    appServices.runtimeConfig.currentUser.permissions = [
      "admin-authz:grant",
      "admin-authz:revoke",
    ];
    mocks.listUsersPage.mockResolvedValue({ total: 0, users: [] });
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(), addListener: vi.fn(), dispatchEvent: vi.fn(), matches: false,
      media: query, onchange: null, removeEventListener: vi.fn(), removeListener: vi.fn(),
    }));
  });

  it("renders the backend effective decision instead of merging source operations", async () => {
    mocks.listObjectGrantsForObject.mockResolvedValue({
      accounts: [],
      grants: [grant(
        [
          source({}),
          source({ grantId: "role-view", inherited: true, policySource: "role_permission" }),
        ],
        {
          effectiveDecisions: [{
            basis: "direct",
            decision: "deny",
            deniedRequirement: "view_detail",
            operation: "modify",
            requires: ["view_detail"],
          }],
        },
      )],
    });

    render(<ObjectAuthorizeDrawer objId="catalog-1" objName="Customer catalog" objType="catalog" onClose={vi.fn()} open />);
    await act(async () => {});

    expect(screen.getByLabelText(/systemAdmin\.objectGrants\.permissionDenied/)).not.toBeNull();
    fireEvent.click(screen.getByText("common.viewDetails"));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getAllByText("systemAdmin.objectGrants.readOnlySource")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "common.back" }));
    expect(screen.getByText("systemAdmin.objectGrants.grantDetails")).not.toBeNull();
  });

  it("revokes one direct source by stable grant_id", async () => {
    mocks.listObjectGrantsForObject.mockResolvedValue({ accounts: [], grants: [grant([source({})])] });
    render(<ObjectAuthorizeDrawer objId="catalog-1" objName="Customer catalog" objType="catalog" onClose={vi.fn()} open />);
    await act(async () => {});

    fireEvent.click(screen.getByText("common.viewDetails"));
    const deleteActions = screen.getAllByText("systemAdmin.objectGrants.deleteGrant");
    fireEvent.click(deleteActions.at(-1) as HTMLElement);
    const config = appServices.modal.confirm.mock.calls[0]?.[0] as { onOk: () => Promise<void> };
    await config.onOk();

    expect(mocks.revokeObjectGrantForObject).toHaveBeenCalledWith("grant-direct-view");
  });

  it("allows ordinary direct grants for a built-in administrator to be revoked", async () => {
    mocks.getCachedUserSync.mockImplementation((id: string) => id === "u-admin"
      ? {
          account: "local-admin",
          accountType: "local",
          builtin: true,
          email: "",
          enabled: true,
          id,
          name: "Local Admin",
          roleIds: [],
          telephone: "",
        }
      : undefined);
    mocks.listObjectGrantsForObject.mockResolvedValue({
      accounts: [],
      grants: [grant(
        [source({ accessorId: "u-admin", grantId: "grant-admin-view" })],
        { accessorId: "u-admin" },
      )],
    });
    render(
      <ObjectAuthorizeDrawer
        objId="catalog-1"
        objName="Customer catalog"
        objType="catalog"
        onClose={vi.fn()}
        open
      />,
    );
    await act(async () => {});

    const deleteButton = rowDeleteButton("Local Admin");
    expect(deleteButton.disabled).toBe(false);
    fireEvent.click(deleteButton);
    const config = appServices.modal.confirm.mock.calls[0]?.[0] as {
      onOk: () => Promise<void>;
    };
    await config.onOk();

    expect(mocks.revokeObjectGrantForObject).toHaveBeenCalledWith("grant-admin-view");
  });

  it("keeps prerequisites selected in the explicit operation picker", async () => {
    mocks.listObjectGrantsForObject.mockResolvedValue({ accounts: [], grants: [] });
    render(<ObjectAuthorizeDrawer objId="catalog-1" objName="Customer catalog" objType="catalog" onClose={vi.fn()} open />);
    await act(async () => {});

    const viewOperation = screen.getByRole("button", { name: /view_detail/ });
    fireEvent.click(screen.getByRole("button", { name: /modify/ }));

    expect(viewOperation.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(viewOperation);
    expect(viewOperation.getAttribute("aria-pressed")).toBe("true");
  });

  it("renders a stable permission summary and a dedicated empty state", async () => {
    mocks.listObjectGrantsForObject.mockResolvedValue({ accounts: [], grants: [] });
    render(<ObjectAuthorizeDrawer objId="resource-1" objName="Orders" objType="resource" onClose={vi.fn()} open />);
    await act(async () => {});

    expect(screen.getByText("systemAdmin.objectGrants.newGrantTitle")).not.toBeNull();
    expect(screen.getByText("systemAdmin.objectGrants.drawerEmptyHelp")).not.toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("requires explicit full business access selection in community mode", async () => {
    mocks.useCapability.mockReturnValue("not-licensed");
    mocks.listObjectGrantsForObject.mockResolvedValue({
      accounts: [],
      grants: [
        grant([], { accessorId: "empty-admin", operations: [] }),
        grant(
          [source({
            accessorId: "u-community",
            grantId: "community-bundle-1",
            operation: "full_business_access",
            policySource: "community_bundle",
          })],
          {
            accessorId: "u-community",
            bundle: "full_business_access",
            operations: ["full_business_access"],
          },
        ),
      ],
    });
    render(
      <ObjectAuthorizeDrawer
        objId="catalog-1"
        objName="Customer catalog"
        objType="catalog"
        onClose={vi.fn()}
        open
        prefillGranteeId="u-new"
      />,
    );
    await act(async () => {});

    const bundleButton = screen.getByRole("button", { name: /full_business_access/ });
    const addButton = screen.getByRole("button", {
      name: /systemAdmin\.objectGrants\.addGrant/,
    });
    expect(bundleButton.getAttribute("aria-pressed")).toBe("false");
    expect(addButton.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("systemAdmin.objectGrants.grantNeedsBundle")).not.toBeNull();
    expect(screen.getByText(
      "systemAdmin.objectGrants.selectedOperationCount:0/1",
    )).not.toBeNull();
    expect(screen.queryByText("empty-admin")).toBeNull();
    expect(screen.getByText("systemAdmin.objectGrants.effectivePermissions")).not.toBeNull();

    fireEvent.click(bundleButton);

    expect(bundleButton.getAttribute("aria-pressed")).toBe("true");
    expect(addButton.hasAttribute("disabled")).toBe(false);
    expect(screen.getByText("systemAdmin.objectGrants.grantBundleReady")).not.toBeNull();
    fireEvent.click(addButton);
    await act(async () => {});

    expect(mocks.upsertObjectGrantForObject).toHaveBeenCalledWith({
      accessorId: "u-new",
      bundle: "full_business_access",
      objId: "catalog-1",
      objName: "Customer catalog",
      objSub: undefined,
      objType: "catalog",
    });
  });

  it("does not downgrade an unknown capability snapshot to the Community bundle", async () => {
    mocks.useCapability.mockReturnValue("unknown");
    mocks.listObjectGrantsForObject.mockResolvedValue({
      accounts: [],
      grants: [grant([source({})])],
    });

    render(
      <ObjectAuthorizeDrawer
        objId="catalog-1"
        objName="Customer catalog"
        objType="catalog"
        onClose={vi.fn()}
        open
        prefillGranteeId="u-new"
      />,
    );
    await act(async () => {});

    expect(screen.getByText("professional-edition-gate")).not.toBeNull();
    expect(screen.queryByRole("button", { name: /full_business_access/ })).toBeNull();
    expect(screen.queryByText("systemAdmin.objectGrants.newGrantTitle")).toBeNull();
    expect(mocks.upsertObjectGrantForObject).not.toHaveBeenCalled();
  });

  it("gates child-resource authorization instead of offering the Community bundle", async () => {
    mocks.useCapability.mockReturnValue("not-licensed");
    mocks.listObjectGrantsForObject.mockResolvedValue({ accounts: [], grants: [] });

    render(
      <ObjectAuthorizeDrawer
        objId="network-1/action-1"
        objName="Submit order"
        objType="action_type"
        onClose={vi.fn()}
        open
      />,
    );
    await act(async () => {});

    expect(screen.getByText("professional-edition-gate")).not.toBeNull();
    expect(screen.queryByRole("button", { name: /full_business_access/ })).toBeNull();
  });

  it("blocks deleting a prerequisite source while an allowed operation depends on it", async () => {
    const dependentGrant = grant([
      source({}),
      source({ grantId: "grant-direct-modify", operation: "modify" }),
    ]);
    dependentGrant.effectiveDecisions = [
      { basis: "direct", decision: "allow", operation: "view_detail", requires: [] },
      {
        basis: "direct",
        decision: "allow",
        operation: "modify",
        requires: ["view_detail"],
      },
    ];
    mocks.listObjectGrantsForObject.mockResolvedValue({ accounts: [], grants: [dependentGrant] });
    render(<ObjectAuthorizeDrawer objId="catalog-1" objName="Customer catalog" objType="catalog" onClose={vi.fn()} open />);
    await act(async () => {});

    fireEvent.click(screen.getByText("common.viewDetails"));
    const deleteActions = screen.getAllByText("systemAdmin.objectGrants.deleteGrant");
    expect((deleteActions[0].closest("button") as HTMLButtonElement).disabled).toBe(true);
    expect((deleteActions[1].closest("button") as HTMLButtonElement).disabled).toBe(false);
  });

  it("protects public and authorize-holder rows from delegate deletion", async () => {
    const publicAccessorId = "00000000-0000-0000-0000-000000000000";
    appServices.runtimeConfig.currentUser.id = "u-owner";
    appServices.runtimeConfig.currentUser.permissions = [];
    mocks.listObjectGrantsForObject.mockResolvedValue({
      accounts: [],
      grants: [
        grant(
          [source({ accessorId: "u-owner", grantId: "owner-authorize", operation: "authorize" })],
          { accessorId: "u-owner" },
        ),
        grant(
          [source({ accessorId: publicAccessorId, grantId: "public-view" })],
          { accessorId: publicAccessorId },
        ),
        grant([source({})]),
      ],
    });

    render(<ObjectAuthorizeDrawer objectAuthorized objId="catalog-1" objName="Customer catalog" objType="catalog" onClose={vi.fn()} open />);
    await act(async () => {});

    expect(rowDeleteButton("u-owner").disabled).toBe(true);
    expect(rowDeleteButton(publicAccessorId).disabled).toBe(true);
    expect(rowDeleteButton("u-mate").disabled).toBe(false);
  });

  it("prevents a revoke-only administrator from deleting their own authorize row", async () => {
    appServices.runtimeConfig.currentUser.id = "u-owner";
    appServices.runtimeConfig.currentUser.permissions = ["admin-authz:revoke"];
    mocks.listObjectGrantsForObject.mockResolvedValue({
      accounts: [],
      grants: [
        grant(
          [source({ accessorId: "u-owner", grantId: "owner-authorize", operation: "authorize" })],
          { accessorId: "u-owner" },
        ),
        grant(
          [source({ grantId: "mate-authorize", operation: "authorize" })],
          { accessorId: "u-mate" },
        ),
      ],
    });

    render(<ObjectAuthorizeDrawer objId="catalog-1" objName="Customer catalog" objType="catalog" onClose={vi.fn()} open />);
    await act(async () => {});

    expect(rowDeleteButton("u-owner").disabled).toBe(true);
    expect(rowDeleteButton("u-mate").disabled).toBe(false);
  });
});
