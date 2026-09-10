/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PropsWithChildren, ReactNode } from "react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appServices: {
    message: { error: vi.fn(), success: vi.fn() },
    modal: { confirm: vi.fn() },
    runtimeConfig: { currentUser: { permissions: [] } },
  },
  getDetail: vi.fn(),
  listObjectGrantsForObject: vi.fn(),
  listPropertyGrantSnapshot: vi.fn(),
  listRoles: vi.fn(),
  listUsersPage: vi.fn(),
  navigate: vi.fn(),
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
  useCapability: () => "available",
}));

vi.mock("@/framework/entitlement/EditionBadge", () => ({
  EditionBadge: () => null,
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
  listObjectGrantsForObject: mocks.listObjectGrantsForObject,
  revokeObjectGrantForObject: vi.fn(),
  upsertObjectGrantForObject: vi.fn(),
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
    mocks.getDetail.mockImplementation(() => new Promise(() => undefined));
    mocks.listObjectGrantsForObject.mockResolvedValue({ accounts: [], grants: [] });
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

  it("does not show an estimated-result warning when server decisions are unavailable", async () => {
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
      (await screen.findAllByText("knowledgeNetwork.propertyAuthorizationColumnEffective")).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText("knowledgeNetwork.propertyAuthorizationEstimatedResult")).toBeNull();
    expect(screen.queryByText("knowledgeNetwork.propertyAuthorizationDecisionUnavailable")).toBeNull();
  });
});
