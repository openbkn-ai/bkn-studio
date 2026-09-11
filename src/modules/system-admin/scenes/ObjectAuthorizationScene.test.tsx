/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ObjectGrant } from "@/modules/system-admin/types/authz";

const listObjectGrantsPageMock = vi.hoisted(() => vi.fn());
const capability = vi.hoisted((): { current: string } => ({ current: "available" }));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    runtimeConfig: { currentUser: { id: "u-admin", permissions: ["admin-authz:grant", "admin-authz:revoke"] } },
  }),
}));
vi.mock("@/framework/entitlement/use-entitlement", () => ({
  useCapability: () => capability.current,
}));
vi.mock("@/modules/system-admin/services/authz.service", () => ({
  listObjectGrantsPage: listObjectGrantsPageMock,
  listObjectGroups: vi.fn(() => Promise.resolve({ groups: [], total: 0 })),
}));
vi.mock("@/modules/system-admin/services/authz-objects.service", () => ({
  resolveGrantNames: (grants: ObjectGrant[]) => Promise.resolve(grants),
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
    listObjectGrantsPageMock.mockResolvedValue({
      grants: [{
        accessorId: "u-mate",
        deniedOperations: ["modify"],
        effectiveDecisions: [{ basis: "direct", decision: "deny", operation: "modify", requires: [] }],
        objId: "catalog-1",
        objName: "Customer catalog",
        objType: "catalog",
        operations: ["view_detail"],
      }],
      summary: { grantees: 1, grants: 1, objects: 1 },
      total: 1,
    });
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(), addListener: vi.fn(), dispatchEvent: vi.fn(), matches: false,
      media: query, onchange: null, removeEventListener: vi.fn(), removeListener: vi.fn(),
    }));
  });

  it("shows server decisions and keeps aggregate rows free of destructive revoke actions", async () => {
    render(<ObjectAuthorizationScene />);
    await act(async () => {});

    expect(screen.queryByText("systemAdmin.objectGrants.calloutPrefix", { exact: false }))
      .toBeNull();
    fireEvent.click(screen.getByRole("button", {
      name: /systemAdmin\.objectGrants\.permissionHelp$/,
    }));
    expect(await screen.findByText("systemAdmin.objectGrants.calloutPrefix", { exact: false }))
      .not.toBeNull();
    expect(screen.getByText("修改")).not.toBeNull();
    const [actions] = screen.getAllByLabelText("systemAdmin.objectGrants.columns.actions");
    fireEvent.click(actions);
    await act(async () => {});
    expect(screen.queryByText("systemAdmin.objectGrants.revoke")).toBeNull();
    expect(screen.getByText("systemAdmin.objectGrants.manage")).not.toBeNull();
  });

  it("shows fine-grained child types but omits retired model resources", async () => {
    render(<ObjectAuthorizationScene />);
    await act(async () => {});

    fireEvent.mouseDown(screen.getByRole("combobox", {
      name: "systemAdmin.objectGrants.filterObjType",
    }));
    const options = within(await screen.findByRole("listbox"));

    expect(options.getByRole("option", { name: "数据目录" })).not.toBeNull();
    expect(options.getByRole("option", { name: "数据资源" })).not.toBeNull();
    expect(options.queryByRole("option", { name: "小模型" })).toBeNull();
    expect(options.queryByRole("option", { name: "大模型" })).toBeNull();
  });

  it("limits Community filters to top-level authorizable resources", async () => {
    capability.current = "not-installed";
    render(<ObjectAuthorizationScene />);
    await act(async () => {});

    const typeFilter = screen.getByRole("combobox", {
      name: "systemAdmin.objectGrants.filterObjType",
    });
    fireEvent.mouseDown(typeFilter);
    const options = within(await screen.findByRole("listbox"));

    expect(options.getByRole("option", { name: "数据目录" })).not.toBeNull();
    expect(options.getByRole("option", { name: "知识网络" })).not.toBeNull();
    expect(options.queryByRole("option", { name: "数据资源" })).toBeNull();
    expect(options.queryByRole("option", { name: "对象类" })).toBeNull();
    expect(options.queryByRole("option", { name: "小模型" })).toBeNull();
    expect(options.queryByRole("option", { name: "大模型" })).toBeNull();
  });
});
