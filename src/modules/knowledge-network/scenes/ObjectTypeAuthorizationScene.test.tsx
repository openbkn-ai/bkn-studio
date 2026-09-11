/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { PropsWithChildren, ReactNode } from "react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appServices: {
    message: { error: vi.fn(), success: vi.fn() },
    modal: { confirm: vi.fn() },
    runtimeConfig: { currentUser: { permissions: [] } },
  },
  getDetail: vi.fn(),
  listEnterpriseObjectGrants: vi.fn(),
  listObjectGrantsForObject: vi.fn(),
  listPropertyGrantSnapshot: vi.fn(),
  listRoles: vi.fn(),
  listUsersPage: vi.fn(),
  navigate: vi.fn(),
  networkAuthorized: true,
  propertyCapability: "available",
  revokeObjectGrantForObject: vi.fn(),
  snapshot: {
    capabilities: ["perm_fine_grained", "perm_object_level"],
    edition: "enterprise",
    extensions: ["perm_fine_grained", "perm_object_level"],
    features: ["perm_fine_grained", "perm_object_level"],
    licensed: true,
    limits: {},
    state: "valid",
  },
  upsertObjectGrantForObject: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => mocks.navigate,
  useParams: () => ({ networkId: "network-1", objectTypeId: "object-1" }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => mocks.appServices,
}));

vi.mock("@/framework/entitlement/use-entitlement", () => ({
  useCapability: () => mocks.propertyCapability,
  useEntitlementContext: () => ({ loading: false, snapshot: mocks.snapshot }),
}));

vi.mock("@/framework/entitlement/EditionBadge", () => ({
  EditionBadge: ({ edition }: { edition: string }) => (
    <span data-testid={`edition-badge-${edition}`}>{edition}</span>
  ),
}));

vi.mock("@/modules/knowledge-network/hooks/useKnowledgeNetworkCanModify", () => ({
  useKnowledgeNetworkCanOperate: () => mocks.networkAuthorized,
}));

vi.mock("@/modules/knowledge-network/services/object-type.service", () => ({
  getKnowledgeNetworkObjectTypeDetail: mocks.getDetail,
  updateKnowledgeNetworkObjectType: vi.fn(),
}));

vi.mock("@/modules/knowledge-network/services/property-authorization.service", () => ({
  listPropertyGrantSnapshot: mocks.listPropertyGrantSnapshot,
  patchPropertyGrants: vi.fn(),
}));

vi.mock("@/modules/system-admin/services/admin.service", () => ({
  listRoles: mocks.listRoles,
  listUsersPage: mocks.listUsersPage,
}));

vi.mock("@/modules/system-admin/services/authz.service", () => ({
  listEnterpriseObjectGrants: mocks.listEnterpriseObjectGrants,
  listObjectGrantsForObject: mocks.listObjectGrantsForObject,
  revokeObjectGrantForObject: mocks.revokeObjectGrantForObject,
  upsertObjectGrantForObject: mocks.upsertObjectGrantForObject,
}));

vi.mock(
  "@/modules/knowledge-network/components/object-type/data-attribute/ObjectTypeDataAttributeFormDrawer",
  () => ({ ObjectTypeDataAttributeFormDrawer: () => null }),
);

vi.mock(
  "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceConfigShell",
  () => ({
    KnowledgeNetworkResourceConfigShell: ({
      children,
      loading = false,
      subtitle,
      title,
    }: PropsWithChildren<{
      loading?: boolean;
      subtitle?: ReactNode;
      title: ReactNode;
    }>) => (
      <div data-loading={String(loading)} data-testid="authorization-shell">
        <div>{title}</div>
        <div>{subtitle}</div>
        {children}
      </div>
    ),
  }),
);

import { ObjectTypeAuthorizationScene } from "./ObjectTypeAuthorizationScene";

const originalMatchMedia = window.matchMedia;

describe("ObjectTypeAuthorizationScene", () => {
  beforeAll(() => {
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

  afterAll(() => {
    window.matchMedia = originalMatchMedia;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.networkAuthorized = true;
    mocks.propertyCapability = "available";
    mocks.snapshot = {
      capabilities: ["perm_fine_grained", "perm_object_level"],
      edition: "enterprise",
      extensions: ["perm_fine_grained", "perm_object_level"],
      features: ["perm_fine_grained", "perm_object_level"],
      licensed: true,
      limits: {},
      state: "valid",
    };
    mocks.getDetail.mockImplementation(() => new Promise(() => undefined));
    mocks.listObjectGrantsForObject.mockResolvedValue({ accounts: [], grants: [] });
    mocks.listEnterpriseObjectGrants.mockResolvedValue([]);
    mocks.listPropertyGrantSnapshot.mockResolvedValue({
      accessor: { id: "user-1", type: "user" },
      entries: [],
      objectTypeRef: "network-1/object-1",
    });
    mocks.listRoles.mockResolvedValue([]);
    mocks.listUsersPage.mockResolvedValue({ users: [] });
  });

  it("uses the standard page loading indicator while the initial detail is loading", () => {
    render(<ObjectTypeAuthorizationScene />);

    expect(screen.getByTestId("authorization-shell").dataset.loading).toBe("true");
    expect(screen.getByText("knowledgeNetwork.propertyAuthorizationAction")).not.toBeNull();
    expect(screen.getByText("network-1 / object-1")).not.toBeNull();
  });

  it("uses the page-owned base permission editor instead of the shared drawer", async () => {
    mocks.getDetail.mockResolvedValue({
      color: "#356af6",
      conceptGroupIds: [],
      conceptGroupNames: [],
      dataProperties: [],
      description: "",
      displayKey: "",
      hasIndex: false,
      id: "object-1",
      incrementalKey: "",
      logicProperties: [],
      name: "Customer",
      operations: ["view_detail"],
      primaryKeys: [],
      tags: [],
      updateTime: "",
      updaterName: "",
    });
    const alice = {
      account: "alice",
      accountType: "local",
      email: "alice@example.com",
      enabled: true,
      id: "user-1",
      name: "Alice",
      roleIds: [],
      telephone: "",
    };
    mocks.listUsersPage.mockResolvedValue({ users: [alice] });
    mocks.listObjectGrantsForObject.mockResolvedValue({ accounts: [alice], grants: [] });

    render(<ObjectTypeAuthorizationScene />);

    expect(await screen.findByText("systemAdmin.objectGrants.newGrantTitle")).not.toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("systemAdmin.objectGrants.grantDetails")).not.toBeNull();
    fireEvent.mouseDown(screen.getByRole("combobox", {
      name: "systemAdmin.objectGrants.grantUserLabel",
    }));
    fireEvent.click(await screen.findByText("Alice（alice）"));
    fireEvent.click(screen.getByRole("button", { name: "view_detail" }));
    fireEvent.click(screen.getByRole("button", {
      name: /systemAdmin\.objectGrants\.addGrant/,
    }));

    await waitFor(() => expect(mocks.upsertObjectGrantForObject).toHaveBeenCalledWith({
      accessorId: "user-1",
      effect: "allow",
      objId: "network-1/object-1",
      objName: "Customer",
      objSub: "network-1",
      objType: "object_type",
      operations: ["view_detail"],
    }));
  });

  it("disables deletion when a legacy grant has no stable revocable source id", async () => {
    mocks.getDetail.mockResolvedValue({
      color: "#356af6",
      conceptGroupIds: [],
      conceptGroupNames: [],
      dataProperties: [],
      description: "",
      displayKey: "",
      hasIndex: false,
      id: "object-1",
      incrementalKey: "",
      logicProperties: [],
      name: "Customer",
      operations: ["view_detail"],
      primaryKeys: [],
      tags: [],
      updateTime: "",
      updaterName: "",
    });
    const alice = {
      account: "alice",
      accountType: "local",
      email: "alice@example.com",
      enabled: true,
      id: "user-1",
      name: "Alice",
      roleIds: [],
      telephone: "",
    };
    mocks.listUsersPage.mockResolvedValue({ users: [alice] });
    mocks.listObjectGrantsForObject.mockResolvedValue({
      accounts: [alice],
      grants: [{
        accessorId: "user-1",
        grants: [],
        objId: "network-1/object-1",
        objName: "Customer",
        objSub: "network-1",
        objType: "object_type",
        operations: ["view_detail"],
      }],
    });

    render(<ObjectTypeAuthorizationScene />);

    const row = (await screen.findByText("Alice")).closest("tr");
    const deleteButton = within(row as HTMLElement)
      .getByText("systemAdmin.objectGrants.deleteGrant")
      .closest("button") as HTMLButtonElement;
    expect(deleteButton.hasAttribute("disabled")).toBe(true);
    fireEvent.click(deleteButton);

    expect(mocks.appServices.modal.confirm).not.toHaveBeenCalled();
    expect(mocks.revokeObjectGrantForObject).not.toHaveBeenCalled();
    expect(mocks.upsertObjectGrantForObject).not.toHaveBeenCalled();
  });

  it("allows a built-in administrator's ordinary object permission to be changed", async () => {
    mocks.getDetail.mockResolvedValue({
      color: "#356af6",
      conceptGroupIds: [],
      conceptGroupNames: [],
      dataProperties: [],
      description: "",
      displayKey: "",
      hasIndex: false,
      id: "object-1",
      incrementalKey: "",
      logicProperties: [],
      name: "Customer",
      operations: ["view_detail"],
      primaryKeys: [],
      tags: [],
      updateTime: "",
      updaterName: "",
    });
    const alice = {
      account: "alice",
      accountType: "local",
      builtin: true,
      email: "alice@example.com",
      enabled: true,
      id: "user-1",
      name: "Alice",
      roleIds: [],
      telephone: "",
    };
    mocks.listUsersPage.mockResolvedValue({ users: [alice] });
    mocks.listObjectGrantsForObject.mockResolvedValue({
      accounts: [alice],
      grants: [{
        accessorId: "user-1",
        grants: [
          {
            accessorId: "user-1",
            active: true,
            authoritySource: "admin_authz",
            effect: "allow",
            grantId: "grant-view",
            inherited: false,
            operation: "view_detail",
            policySource: "professional_rule",
          },
          {
            accessorId: "user-1",
            active: true,
            authoritySource: "admin_authz",
            effect: "allow",
            grantId: "grant-modify",
            inherited: false,
            operation: "modify",
            policySource: "professional_rule",
          },
          {
            accessorId: "user-1",
            active: true,
            authoritySource: "admin_authz",
            effect: "allow",
            grantId: "grant-view-duplicate",
            inherited: false,
            operation: "view_detail",
            policySource: "professional_rule",
          },
          {
            accessorId: "user-1",
            active: true,
            authoritySource: "admin_authz",
            effect: "allow",
            grantId: "grant-inherited",
            inherited: true,
            operation: "query_data",
            policySource: "role_permission",
          },
        ],
        objId: "network-1/object-1",
        objName: "Customer",
        objSub: "network-1",
        objType: "object_type",
        operations: ["view_detail", "modify", "query_data"],
      }],
    });

    render(<ObjectTypeAuthorizationScene />);

    const row = (await screen.findByText("Alice")).closest("tr");
    expect(row).not.toBeNull();
    expect(within((row as HTMLElement).closest("table") as HTMLElement)
      .getByText("systemAdmin.objectGrants.effectivePermissions")).not.toBeNull();
    fireEvent.click(within(row as HTMLElement).getByText("common.viewDetails"));
    const sourceDrawer = await screen.findByRole("dialog");
    expect(within(sourceDrawer).getByText("grant-view")).not.toBeNull();
    expect(within(sourceDrawer).getByText("grant-modify")).not.toBeNull();
    expect(within(sourceDrawer).getAllByText("view_detail")).toHaveLength(1);
    expect(within(sourceDrawer).getByText("systemAdmin.objectGrants.collapsedSourceCount"))
      .not.toBeNull();
    fireEvent.click(within(sourceDrawer).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.mouseDown(screen.getByRole("combobox", {
      name: "systemAdmin.objectGrants.grantUserLabel",
    }));
    fireEvent.click(await screen.findByText("Alice（alice）"));
    fireEvent.click(screen.getByRole("button", {
      name: /systemAdmin\.objectGrants\.addGrant/,
    }));
    await waitFor(() => expect(mocks.revokeObjectGrantForObject)
      .toHaveBeenCalledWith("grant-view-duplicate"));
    expect(mocks.upsertObjectGrantForObject).not.toHaveBeenCalled();
    mocks.revokeObjectGrantForObject.mockClear();

    const refreshedRow = (await screen.findByText("Alice")).closest("tr");
    const deleteButton = within(refreshedRow as HTMLElement)
      .getByText("systemAdmin.objectGrants.deleteGrant")
      .closest("button") as HTMLButtonElement;
    expect(deleteButton.disabled).toBe(false);
    fireEvent.click(deleteButton);
    const confirm = mocks.appServices.modal.confirm.mock.calls[0]?.[0] as {
      onOk: () => Promise<void>;
    };
    await act(async () => confirm.onOk());

    expect(mocks.revokeObjectGrantForObject.mock.calls).toEqual([
      ["grant-view"],
      ["grant-modify"],
      ["grant-view-duplicate"],
    ]);
  });

  it("renders clamped effective access when server decisions are unavailable", async () => {
    mocks.getDetail.mockResolvedValue({
      color: "#356af6",
      conceptGroupIds: [],
      conceptGroupNames: [],
      dataProperties: [{
        displayKey: false,
        displayName: "Email",
        incrementalKey: false,
        name: "email",
        primaryKey: false,
        type: "string",
      }],
      description: "",
      displayKey: "",
      hasIndex: false,
      id: "object-1",
      incrementalKey: "",
      logicProperties: [],
      name: "Customer",
      operations: ["modify"],
      primaryKeys: [],
      tags: [],
      updateTime: "",
      updaterName: "",
    });
    mocks.listUsersPage.mockResolvedValue({
      users: [{
        account: "alice",
        accountType: "local",
        email: "alice@example.com",
        enabled: true,
        id: "user-1",
        name: "Alice",
        roleIds: [],
        telephone: "",
      }],
    });

    render(<ObjectTypeAuthorizationScene />);

    fireEvent.click(await screen.findByText("knowledgeNetwork.propertyAuthorizationTabProperty"));
    fireEvent.click(await screen.findByRole("button", { name: /Alice/ }));
    await waitFor(() => expect(mocks.listPropertyGrantSnapshot).toHaveBeenCalled());
    expect(
      (await screen.findAllByText("knowledgeNetwork.propertyAuthorizationLevel.none")).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("keeps the Enterprise property tab visible and shows the standard upgrade gate", async () => {
    mocks.propertyCapability = "not-licensed";
    mocks.snapshot = {
      capabilities: [],
      edition: "professional",
      extensions: ["perm_object_level"],
      features: [],
      licensed: true,
      limits: {},
      state: "valid",
    };
    mocks.getDetail.mockResolvedValue({
      color: "#356af6",
      conceptGroupIds: [],
      conceptGroupNames: [],
      dataProperties: [],
      description: "",
      displayKey: "",
      hasIndex: false,
      id: "object-1",
      incrementalKey: "",
      logicProperties: [],
      name: "Customer",
      operations: ["view_detail"],
      primaryKeys: [],
      tags: [],
      updateTime: "",
      updaterName: "",
    });

    render(<ObjectTypeAuthorizationScene />);

    const propertyTab = await screen.findByText(
      "knowledgeNetwork.propertyAuthorizationTabProperty",
    );
    expect(screen.getByTestId("edition-badge-enterprise")).not.toBeNull();
    fireEvent.click(propertyTab);

    expect((await screen.findAllByText("common.entitlement.unlockTitle")).length)
      .toBeGreaterThan(0);
    expect(screen.getAllByText("common.entitlement.compareEditions").length)
      .toBeGreaterThan(0);
  });

  it("gates object-type base authorization in Community edition", async () => {
    mocks.propertyCapability = "not-licensed";
    mocks.snapshot = {
      capabilities: [],
      edition: "community",
      extensions: [],
      features: [],
      licensed: false,
      limits: {},
      state: "unlicensed",
    };
    mocks.getDetail.mockResolvedValue({
      color: "#356af6",
      conceptGroupIds: [],
      conceptGroupNames: [],
      dataProperties: [],
      description: "",
      displayKey: "",
      hasIndex: false,
      id: "object-1",
      incrementalKey: "",
      logicProperties: [],
      name: "Customer",
      operations: ["view_detail"],
      primaryKeys: [],
      tags: [],
      updateTime: "",
      updaterName: "",
    });

    render(<ObjectTypeAuthorizationScene />);

    expect(await screen.findByText(
      "subscription.capabilities.perm_fine_grained.name",
    )).not.toBeNull();
    expect(screen.queryByText("systemAdmin.objectGrants.newGrantTitle")).toBeNull();
    expect(screen.getAllByTestId("edition-badge-professional").length).toBeGreaterThan(0);
  });

  it("keeps the latest subject snapshot when an earlier request finishes late", async () => {
    mocks.getDetail.mockResolvedValue({
      color: "#356af6",
      conceptGroupIds: [],
      conceptGroupNames: [],
      dataProperties: [{
        displayKey: false,
        displayName: "Email",
        incrementalKey: false,
        name: "email",
        primaryKey: false,
        type: "string",
      }],
      description: "",
      displayKey: "",
      hasIndex: false,
      id: "object-1",
      incrementalKey: "",
      logicProperties: [],
      name: "Customer",
      operations: ["modify"],
      primaryKeys: [],
      tags: [],
      updateTime: "",
      updaterName: "",
    });
    mocks.listUsersPage.mockResolvedValue({
      users: [
        {
          account: "alice",
          accountType: "local",
          email: "alice@example.com",
          enabled: true,
          id: "user-a",
          name: "Alice",
          roleIds: [],
          telephone: "",
        },
        {
          account: "bob",
          accountType: "local",
          email: "bob@example.com",
          enabled: true,
          id: "user-b",
          name: "Bob",
          roleIds: [],
          telephone: "",
        },
      ],
    });
    let resolveAlice!: (value: unknown) => void;
    let resolveBob!: (value: unknown) => void;
    const aliceSnapshot = new Promise((resolve) => {
      resolveAlice = resolve;
    });
    const bobSnapshot = new Promise((resolve) => {
      resolveBob = resolve;
    });
    mocks.listPropertyGrantSnapshot
      .mockImplementationOnce(() => aliceSnapshot)
      .mockImplementationOnce(() => bobSnapshot);

    render(<ObjectTypeAuthorizationScene />);

    fireEvent.click(await screen.findByText("knowledgeNetwork.propertyAuthorizationTabProperty"));
    fireEvent.click(await screen.findByRole("button", { name: /Alice/ }));
    await waitFor(() => expect(mocks.listPropertyGrantSnapshot).toHaveBeenCalledTimes(1));
    fireEvent.click(await screen.findByRole("button", { name: /Bob/ }));
    await waitFor(() => expect(mocks.listPropertyGrantSnapshot).toHaveBeenCalledTimes(2));

    await act(async () => {
      resolveBob({
        accessor: { id: "user-b", type: "user" },
        entries: [{ level: "none", propertyName: "email" }],
        objectTypeRef: "network-1/object-1",
      });
      await bobSnapshot;
    });
    await waitFor(() =>
      expect(screen.getAllByText("knowledgeNetwork.propertyAuthorizationLevel.none").length).toBeGreaterThanOrEqual(3),
    );

    await act(async () => {
      resolveAlice({
        accessor: { id: "user-a", type: "user" },
        entries: [{ level: "full", propertyName: "email" }],
        objectTypeRef: "network-1/object-1",
      });
      await aliceSnapshot;
    });
    expect(screen.queryByText("knowledgeNetwork.propertyAuthorizationLevel.full")).toBeNull();
  });
});
