/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import type { PropsWithChildren, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDetail: vi.fn(() => new Promise(() => undefined)),
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
  useAppServices: () => ({
    message: { error: vi.fn(), success: vi.fn() },
    modal: { confirm: vi.fn() },
    runtimeConfig: { currentUser: { permissions: [] } },
  }),
}));

vi.mock("@/framework/entitlement/use-entitlement", () => ({
  useCapability: () => "available",
}));

vi.mock("@/modules/knowledge-network/services/object-type.service", () => ({
  getKnowledgeNetworkObjectTypeDetail: mocks.getDetail,
  updateKnowledgeNetworkObjectType: vi.fn(),
}));

vi.mock("@/modules/knowledge-network/services/property-authorization.service", () => ({
  listPropertyGrantSnapshot: vi.fn(),
  patchPropertyGrants: vi.fn(),
}));

vi.mock("@/modules/system-admin/services/admin.service", () => ({
  listRoles: vi.fn().mockResolvedValue([]),
  listUsersPage: vi.fn().mockResolvedValue({ users: [] }),
}));

vi.mock("@/modules/system-admin/services/authz.service", () => ({
  listObjectGrantsForObject: vi.fn().mockResolvedValue({ accounts: [], grants: [] }),
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

describe("ObjectTypeAuthorizationScene", () => {
  it("uses the standard page loading indicator while the initial detail is loading", () => {
    render(<ObjectTypeAuthorizationScene />);

    expect(screen.getByTestId("authorization-shell").dataset.loading).toBe("true");
    expect(screen.getByText("knowledgeNetwork.propertyAuthorizationAction")).not.toBeNull();
    expect(screen.getByText("network-1 / object-1")).not.toBeNull();
  });
});
