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
import { PUBLIC_ACCESSOR_ID } from "@/modules/system-admin/utils/object-grant-guards";

const mocks = vi.hoisted(() => ({
  getCachedUserSync: vi.fn(),
  hydrateUserLookupDetails: vi.fn(),
  isDeletedUserSync: vi.fn(),
  listObjectGrantsForObject: vi.fn(),
  listUsersPage: vi.fn(),
  revokeObjectGrantForObject: vi.fn(),
  revokeObjectGrantsForObject: vi.fn(),
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
const authorizationRegistry = vi.hoisted(() => ({
  operationsForType: (type: string) =>
    ({
      action_type: [
        { key: "view_detail", label: "view_detail", requires: [] },
        { key: "modify", label: "modify", requires: ["view_detail"] },
        { key: "delete", label: "delete", requires: ["view_detail"] },
        { key: "execute", label: "execute", requires: [] },
      ],
      catalog: [
        { key: "view_detail", label: "view_detail", requires: [] },
        { key: "create", label: "create", requires: [] },
        { key: "modify", label: "modify", requires: [] },
        { key: "delete", label: "delete", requires: [] },
        { key: "authorize", label: "authorize", requires: [] },
        { key: "task_manage", label: "task_manage", requires: [] },
        { key: "resource_manage", label: "resource_manage", requires: ["view_detail"] },
        { key: "query_data", label: "query_data", requires: [] },
      ],
      resource: [
        { key: "view_detail", label: "view_detail", requires: [] },
        { key: "query_data", label: "query_data", requires: [] },
      ],
    })[type] ?? [],
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
  revokeObjectGrantsForObject: mocks.revokeObjectGrantsForObject,
  upsertObjectGrantForObject: mocks.upsertObjectGrantForObject,
}));
vi.mock("@/modules/system-admin/utils/audit-lookup-cache", () => ({
  getCachedDepartments: vi.fn(() => Promise.resolve([])),
  getCachedUserSync: mocks.getCachedUserSync,
  hydrateUserLookup: vi.fn(() => Promise.resolve([])),
  hydrateUserLookupDetails: mocks.hydrateUserLookupDetails,
  isDeletedUserSync: mocks.isDeletedUserSync,
  isUserLookupId: (id: string) => Boolean(id) && !id.startsWith("system:"),
  primeUserLookupCache: vi.fn(),
}));
vi.mock("@/modules/system-admin/hooks/use-authorization-registry", () => ({
  useAuthorizationRegistry: () => ({
    catalogError: undefined,
    catalogLoading: false,
    operationsForType: authorizationRegistry.operationsForType,
    retryAuthorizationRegistry: vi.fn(),
  }),
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
  const operations = [
    ...new Set(
      records
        .filter((record) => record.active && record.effect === "allow")
        .map((record) => record.operation),
    ),
  ];
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
    mocks.getCachedUserSync.mockImplementation((id: string) => ({
      account: "",
      accountType: "local",
      email: "",
      enabled: true,
      id,
      name: id,
      roleIds: [],
      telephone: "",
    }));
    mocks.hydrateUserLookupDetails.mockResolvedValue({ deleted: [], unavailable: [] });
    mocks.isDeletedUserSync.mockReturnValue(false);
    appServices.runtimeConfig.currentUser.id = "u-admin";
    appServices.runtimeConfig.currentUser.permissions = ["admin-authz:grant", "admin-authz:revoke"];
    mocks.listUsersPage.mockResolvedValue({ total: 0, users: [] });
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

  it("renders the backend effective decision instead of merging source operations", async () => {
    mocks.listObjectGrantsForObject.mockResolvedValue({
      accounts: [],
      grants: [
        grant(
          [
            source({}),
            source({ grantId: "role-view", inherited: true, policySource: "role_permission" }),
          ],
          {
            effectiveDecisions: [
              {
                basis: "direct",
                decision: "deny",
                deniedRequirement: "view_detail",
                operation: "modify",
                requires: ["view_detail"],
              },
            ],
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
      />,
    );
    await act(async () => {});

    expect(screen.getByLabelText(/systemAdmin\.objectGrants\.permissionDenied/)).not.toBeNull();
    fireEvent.click(screen.getByText("common.viewDetails"));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getAllByText("systemAdmin.objectGrants.readOnlySource")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "common.back" }));
    expect(screen.getByText("systemAdmin.objectGrants.grantDetails")).not.toBeNull();
  });

  it("renders the object-scoped response name without waiting for the user cache", async () => {
    mocks.listObjectGrantsForObject.mockResolvedValue({
      accounts: [],
      grants: [
        grant([source({})], {
          accessorAccount: "b",
          accessorName: "普通用户 B",
        }),
      ],
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

    expect(screen.getByText("普通用户 B")).not.toBeNull();
    expect(screen.getByText("b")).not.toBeNull();
    expect(screen.queryByText("u-mate")).toBeNull();
  });

  it("shows the actual grantor name for each independent source", async () => {
    mocks.getCachedUserSync.mockImplementation((id: string) =>
      id === "u-grantor"
        ? {
            account: "grantor.account",
            accountType: "local",
            email: "",
            enabled: true,
            id,
            name: "Grantor B",
            roleIds: [],
            telephone: "",
          }
        : undefined,
    );
    mocks.listObjectGrantsForObject.mockResolvedValue({
      accounts: [],
      grants: [
        grant([source({ createdBy: "u-grantor" })], {
          accessorName: "Grantee C",
        }),
      ],
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
    fireEvent.click(screen.getByText("common.viewDetails"));

    expect(screen.getAllByText("systemAdmin.objectGrants.actualGrantor")).not.toHaveLength(0);
    expect(screen.getByText("Grantor B")).not.toBeNull();
    expect(screen.getByText("grantor.account")).not.toBeNull();
  });

  it("labels a deleted grantee without exposing its internal ID or retrying a 404", async () => {
    mocks.getCachedUserSync.mockReturnValue(undefined);
    mocks.isDeletedUserSync.mockImplementation((id: string) => id === "u-mate");
    mocks.hydrateUserLookupDetails.mockResolvedValue({ deleted: ["u-mate"], unavailable: [] });
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
      />,
    );
    await act(async () => {});

    expect(screen.getByText("systemAdmin.objectGrants.deletedUser")).not.toBeNull();
    expect(screen.queryByText("u-mate")).toBeNull();
    expect(screen.queryByText("systemAdmin.objectGrants.retryGranteeLookup")).toBeNull();
  });

  it("renders a role subject without looking it up as a deleted user", async () => {
    mocks.getCachedUserSync.mockReturnValue(undefined);
    mocks.isDeletedUserSync.mockImplementation((id: string) => id === "role-readers");
    mocks.listObjectGrantsForObject.mockResolvedValue({
      accounts: [],
      grants: [
        grant([source({ accessorId: "role-readers" })], {
          accessorId: "role-readers",
          accessorName: "Readers",
          accessorType: "role",
        }),
      ],
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

    expect(screen.getByText("Readers")).not.toBeNull();
    expect(screen.queryByText("systemAdmin.objectGrants.deletedUser")).toBeNull();
    expect(mocks.hydrateUserLookupDetails).toHaveBeenCalledWith([], expect.any(Object));
  });

  it("renders the public subject without looking it up as a deleted user", async () => {
    mocks.getCachedUserSync.mockReturnValue(undefined);
    mocks.isDeletedUserSync.mockImplementation((id: string) => id === PUBLIC_ACCESSOR_ID);
    mocks.listObjectGrantsForObject.mockResolvedValue({
      accounts: [],
      grants: [
        grant([source({ accessorId: PUBLIC_ACCESSOR_ID })], {
          accessorId: PUBLIC_ACCESSOR_ID,
          accessorType: "public",
        }),
      ],
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

    expect(screen.getByText("systemAdmin.objectGrants.publicSubject")).not.toBeNull();
    expect(screen.queryByText("systemAdmin.objectGrants.deletedUser")).toBeNull();
    expect(mocks.hydrateUserLookupDetails).toHaveBeenCalledWith([], expect.any(Object));
  });

  it("revokes one direct source by stable grant_id", async () => {
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
      />,
    );
    await act(async () => {});

    fireEvent.click(screen.getByText("common.viewDetails"));
    const deleteActions = screen.getAllByText("systemAdmin.objectGrants.deleteGrant");
    fireEvent.click(deleteActions.at(-1) as HTMLElement);
    const config = appServices.modal.confirm.mock.calls[0]?.[0] as { onOk: () => Promise<void> };
    await config.onOk();

    expect(mocks.revokeObjectGrantForObject).toHaveBeenCalledWith("grant-direct-view");
  });

  it("allows ordinary direct grants for a built-in administrator to be revoked", async () => {
    mocks.getCachedUserSync.mockImplementation((id: string) =>
      id === "u-admin"
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
        : undefined,
    );
    mocks.listObjectGrantsForObject.mockResolvedValue({
      accounts: [],
      grants: [
        grant([source({ accessorId: "u-admin", grantId: "grant-admin-view" })], {
          accessorId: "u-admin",
        }),
      ],
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

    expect(mocks.revokeObjectGrantsForObject).toHaveBeenCalledWith(["grant-admin-view"]);
  });

  it("keeps prerequisites selected in the explicit operation picker", async () => {
    mocks.listObjectGrantsForObject.mockResolvedValue({ accounts: [], grants: [] });
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

    const viewOperation = screen.getByRole("button", { name: /view_detail/ });
    fireEvent.click(screen.getByRole("button", { name: /resource_manage/ }));

    expect(viewOperation.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(viewOperation);
    expect(viewOperation.getAttribute("aria-pressed")).toBe("true");
  });

  it("renders a stable permission summary and a dedicated empty state", async () => {
    mocks.listObjectGrantsForObject.mockResolvedValue({ accounts: [], grants: [] });
    render(
      <ObjectAuthorizeDrawer
        objId="resource-1"
        objName="Orders"
        objType="resource"
        onClose={vi.fn()}
        open
      />,
    );
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
          [
            source({
              accessorId: "u-community",
              grantId: "community-bundle-1",
              operation: "full_business_access",
              policySource: "community_bundle",
            }),
          ],
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
    expect(screen.getByText("systemAdmin.objectGrants.selectedOperationCount:0/1")).not.toBeNull();
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
      source({ grantId: "grant-direct-resource-manage", operation: "resource_manage" }),
    ]);
    dependentGrant.effectiveDecisions = [
      { basis: "direct", decision: "allow", operation: "view_detail", requires: [] },
      {
        basis: "direct",
        decision: "allow",
        operation: "resource_manage",
        requires: ["view_detail"],
      },
    ];
    mocks.listObjectGrantsForObject.mockResolvedValue({ accounts: [], grants: [dependentGrant] });
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

    fireEvent.click(screen.getByText("common.viewDetails"));
    const deleteActions = screen.getAllByText("systemAdmin.objectGrants.deleteGrant");
    expect((deleteActions[0].closest("button") as HTMLButtonElement).disabled).toBe(true);
    expect((deleteActions[1].closest("button") as HTMLButtonElement).disabled).toBe(false);
  });

  it("allows one duplicate prerequisite source to be revoked", async () => {
    const duplicateGrant = grant([
      source({ grantId: "grant-view-a" }),
      source({ createdBy: "u-other", grantId: "grant-view-b" }),
      source({ grantId: "grant-resource-manage", operation: "resource_manage" }),
    ]);
    duplicateGrant.effectiveDecisions = [
      { basis: "direct", decision: "allow", operation: "view_detail", requires: [] },
      {
        basis: "direct",
        decision: "allow",
        operation: "resource_manage",
        requires: ["view_detail"],
      },
    ];
    mocks.listObjectGrantsForObject.mockResolvedValue({ accounts: [], grants: [duplicateGrant] });
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

    fireEvent.click(screen.getByText("common.viewDetails"));
    const deleteActions = screen.getAllByText("systemAdmin.objectGrants.deleteGrant");
    expect((deleteActions[0].closest("button") as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(deleteActions[0]);
    const confirm = appServices.modal.confirm.mock.calls[0]?.[0] as { onOk: () => Promise<void> };
    await confirm.onOk();

    expect(mocks.revokeObjectGrantForObject).toHaveBeenCalledWith("grant-view-a");
  });

  it("keeps a grant-only owner scoped to its own sources beside authorize", async () => {
    const publicAccessorId = "00000000-0000-0000-0000-000000000000";
    appServices.runtimeConfig.currentUser.id = "u-owner";
    appServices.runtimeConfig.currentUser.permissions = ["admin-authz:grant"];
    mocks.listObjectGrantsForObject.mockResolvedValue({
      accounts: [],
      grants: [
        grant(
          [
            source({ accessorId: "u-owner", grantId: "owner-authorize", operation: "authorize" }),
            source({
              accessorId: "u-owner",
              authoritySource: "owner_delegate",
              createdBy: "u-owner",
              grantId: "owner-view",
            }),
          ],
          { accessorId: "u-owner" },
        ),
        grant([source({ accessorId: publicAccessorId, grantId: "public-view" })], {
          accessorId: publicAccessorId,
        }),
        grant([source({ authoritySource: "owner_delegate", createdBy: "u-owner" })]),
        grant(
          [
            source({
              accessorId: "u-other",
              authoritySource: "owner_delegate",
              createdBy: "u-another",
            }),
          ],
          { accessorId: "u-other" },
        ),
      ],
    });

    render(
      <ObjectAuthorizeDrawer
        objectAuthorized
        objId="catalog-1"
        objName="Customer catalog"
        objType="catalog"
        onClose={vi.fn()}
        open
      />,
    );
    await act(async () => {});

    expect(rowDeleteButton("u-owner").disabled).toBe(false);
    expect(rowDeleteButton("systemAdmin.objectGrants.publicSubject").disabled).toBe(true);
    expect(rowDeleteButton("u-mate").disabled).toBe(false);
    expect(rowDeleteButton("u-other").disabled).toBe(true);
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
        grant([source({ grantId: "mate-authorize", operation: "authorize" })], {
          accessorId: "u-mate",
        }),
      ],
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

    expect(rowDeleteButton("u-owner").disabled).toBe(true);
    expect(rowDeleteButton("u-mate").disabled).toBe(false);
  });
});
