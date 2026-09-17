/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { AdminDepartment, AdminRole, AdminUser } from "@/modules/system-admin/types/admin";

const mocks = vi.hoisted(() => ({
  getCachedUserSync: vi.fn(),
  hydrateUserLookupDetails: vi.fn(),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: { error: vi.fn(), success: vi.fn() } }),
}));
vi.mock("@/modules/system-admin/services/admin.service", () => ({
  setRoleMember: vi.fn(),
}));
vi.mock("@/modules/system-admin/utils/audit-lookup-cache", () => ({
  getCachedUserSync: mocks.getCachedUserSync,
  hydrateUserLookupDetails: mocks.hydrateUserLookupDetails,
}));
vi.mock("./DirectoryUserPicker", () => ({ DirectoryUserPicker: () => <div /> }));
vi.mock("@/framework/ui/common/AppButton", () => ({
  AppButton: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
}));
vi.mock("@/framework/ui/common/AppTable", () => ({
  AppTable: ({ dataSource }: { dataSource: Array<{ id: string; label: string }> }) => (
    <div>{dataSource.map((member) => <span key={member.id}>{member.label}</span>)}</div>
  ),
}));
vi.mock("@/framework/ui/common/EmptyStatePanel", () => ({ EmptyStatePanel: () => <div /> }));
vi.mock("@/framework/ui/common/TablePaginationBar", () => ({ TablePaginationBar: () => <div /> }));
vi.mock("antd", () => ({
  Input: () => <input />,
  Modal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Tag: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import { RoleMembersModal } from "./RoleMembersModal";

const role = (accessorIds: string[]): AdminRole => ({
  accessorIds,
  builtin: false,
  description: "",
  id: "role-readers",
  name: "Readers",
  permissions: [],
});

const noDepartments: AdminDepartment[] = [];

describe("RoleMembersModal user lookup lifecycle", () => {
  it("retries a member label after a member-list update cancels its first lookup", async () => {
    let resolveFirst!: () => void;
    let resolveSecond!: () => void;
    const firstLookup = new Promise<void>((resolve) => { resolveFirst = resolve; });
    const secondLookup = new Promise<void>((resolve) => { resolveSecond = resolve; });
    mocks.hydrateUserLookupDetails
      .mockImplementationOnce(() => firstLookup)
      .mockImplementation(() => secondLookup);
    mocks.getCachedUserSync.mockImplementation((id: string): AdminUser | undefined => id === "u-second"
      ? {
          account: "second",
          accountType: "local",
          email: "",
          enabled: true,
          id,
          name: "Second User",
          roleIds: [],
          telephone: "",
        }
      : undefined);

    const view = render(
      <RoleMembersModal departments={noDepartments} onChanged={vi.fn()} onClose={vi.fn()} open role={role(["u-first"])} />,
    );
    await act(async () => {});
    view.rerender(
      <RoleMembersModal
        departments={noDepartments}
        onChanged={vi.fn()}
        onClose={vi.fn()}
        open
        role={role(["u-first", "u-second"])}
      />,
    );
    await act(async () => {});
    resolveFirst();
    await act(async () => {});

    expect(mocks.hydrateUserLookupDetails).toHaveBeenCalledTimes(2);
    resolveSecond();
    await act(async () => {});
    expect(screen.getByText("Second User（second）")).not.toBeNull();
  });
});
