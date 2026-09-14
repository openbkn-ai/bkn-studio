/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ObjectGrant } from "@/modules/system-admin/types/authz";

const listObjectGrantsPageMock = vi.hoisted(() => vi.fn());
const resolveGrantNamesMock = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("antd", async (importOriginal) => ({
  ...(await importOriginal<typeof import("antd")>()),
  Drawer: ({ children, open }: { children: ReactNode; open: boolean }) => open ? <div data-testid="permission-drawer">{children}</div> : null,
}));
vi.mock("@/modules/system-admin/services/authz.service", () => ({
  listObjectGrantsPage: listObjectGrantsPageMock,
}));
vi.mock("@/modules/system-admin/services/authz-objects.service", () => ({
  resolveGrantNames: resolveGrantNamesMock,
}));
vi.mock("@/modules/system-admin/components/DirectoryUserPicker", () => ({
  DirectoryUserPicker: ({ onUsersChange }: { onUsersChange: (users: Array<{ account: string; id: string; name: string; roleIds: string[]; roleNames?: string[] }>) => void }) => (
    <div>
      <button onClick={() => onUsersChange([{ id: "user-1", account: "user-1", name: "User One", roleIds: [] }])} type="button">
        select-user
      </button>
      <button onClick={() => onUsersChange([{ id: "super-admin", account: "super_admin", name: "Super Administrator", roleIds: [], roleNames: ["super_admin"] }])} type="button">
        select-super-admin
      </button>
    </div>
  ),
}));
vi.mock("@/framework/ui/common/AppTable", () => ({
  AppTable: ({ columns, dataSource, loading }: {
    columns: Array<{ render?: (value: unknown, record: ObjectGrant, index: number) => ReactNode }>;
    dataSource: ObjectGrant[];
    loading?: boolean;
  }) => (
    <div data-loading={String(loading)} data-testid="grant-table">
      {dataSource.map((grant, index) => <div key={grant.objId}>{columns[2]?.render?.(undefined, grant, index)}</div>)}
    </div>
  ),
}));
vi.mock("@/modules/system-admin/utils/resource-catalog", () => ({
  operationLabel: (_type: string, operation: string) => operation,
  resourceTypeLabel: (type: string) => type,
}));

import { MemberAuthorizationPanel } from "./MemberAuthorizationPanel";

describe("MemberAuthorizationPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows grants without waiting for slow resource-name enrichment", async () => {
    listObjectGrantsPageMock.mockResolvedValue({
      grants: [{
        accessorId: "user-1",
        objId: "catalog-1",
        objName: "catalog-1",
        objType: "catalog",
        operations: ["view_detail"],
      }],
      total: 1,
    });
    resolveGrantNamesMock.mockImplementation(() => new Promise(() => undefined));

    render(<MemberAuthorizationPanel departments={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "select-user" }));

    await waitFor(() => expect(screen.getByTestId("grant-table").dataset.loading).toBe("false"));
    expect(screen.getByTestId("grant-table").textContent).toContain("systemAdmin.objectGrants.memberPermissionDetail");
    expect(resolveGrantNamesMock).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "systemAdmin.objectGrants.memberPermissionDetail" }));
    expect(screen.getByTestId("permission-drawer").textContent).toContain("view_detail");
  });

  it("renders the super-admin wildcard without requesting object-grant records", async () => {
    render(<MemberAuthorizationPanel departments={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "select-super-admin" }));

    expect(screen.getByLabelText("systemAdmin.objectGrants.memberSuperAdminTitle").textContent).toBe("*");
    expect(screen.queryByTestId("grant-table")).toBeNull();
    await waitFor(() => expect(listObjectGrantsPageMock).not.toHaveBeenCalled());
    expect(resolveGrantNamesMock).not.toHaveBeenCalled();
  });
});
