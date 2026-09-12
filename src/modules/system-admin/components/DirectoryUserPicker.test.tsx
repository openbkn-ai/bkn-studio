/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  listDepartments: vi.fn(),
  listUsersPage: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const count = options?.count;
      const department = options?.department;
      if (typeof department === "string") {
        return `${key}:${department}`;
      }
      return typeof count === "number" ? `${key}:${count}` : key;
    },
  }),
}));

vi.mock("@/modules/system-admin/services/admin.service", () => mocks);

import { DirectoryUserPicker } from "./DirectoryUserPicker";

const departments = [
  {
    id: "root",
    memberCount: 0,
    name: "OpenBKN",
    parentId: null,
    subtreeMemberCount: 2,
    type: "org",
  },
  {
    id: "engineering",
    memberCount: 1,
    name: "Engineering",
    parentId: "root",
    subtreeMemberCount: 1,
    type: "dept",
  },
];

const users = [
  {
    account: "li.mubai",
    accountType: "local",
    email: "",
    enabled: true,
    id: "user-1",
    name: "Mubai Li",
    roleIds: [],
    telephone: "",
  },
  {
    account: "chen.yanqiu",
    accountType: "local",
    email: "",
    enabled: true,
    id: "user-2",
    name: "Yanqiu Chen",
    roleIds: [],
    telephone: "",
  },
];

const thirdUser = {
  account: "zoe.lin",
  accountType: "local",
  email: "",
  enabled: true,
  id: "user-3",
  name: "Zoe Lin",
  roleIds: [],
  telephone: "",
};

describe("DirectoryUserPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listDepartments.mockResolvedValue(departments);
    mocks.listUsersPage.mockResolvedValue({ total: users.length, users });
    mocks.getUser.mockImplementation((id: string) =>
      Promise.resolve(users.find((user) => user.id === id)));
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

  it("uses the organization tree to request users from a department subtree", async () => {
    render(<DirectoryUserPicker ariaLabel="授权用户" onChange={vi.fn()} />);

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "授权用户" }));
    expect(await screen.findByText("Engineering")).not.toBeNull();
    expect(mocks.listDepartments).toHaveBeenCalledWith({ skipErrorToast: true });
    fireEvent.click(screen.getByText("Engineering"));

    await waitFor(() => {
      expect(mocks.listUsersPage).toHaveBeenCalledWith(
        expect.objectContaining({ departmentId: "engineering", includeSubtree: true }),
        { skipErrorToast: true },
      );
    });
  });

  it("keeps multi-selection user based when navigating departments", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <DirectoryUserPicker
        ariaLabel="授权用户"
        initialUsers={users}
        mode="multiple"
        onChange={onChange}
        value={[]}
      />,
    );

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "授权用户" }));
    const listbox = await screen.findByRole("listbox");
    fireEvent.click(within(listbox).getByRole("option", { name: /Mubai Li/ }));
    expect(onChange).toHaveBeenLastCalledWith(["user-1"]);

    rerender(
      <DirectoryUserPicker
        ariaLabel="授权用户"
        initialUsers={users}
        mode="multiple"
        onChange={onChange}
        value={["user-1"]}
      />,
    );
    fireEvent.click(within(listbox).getByRole("option", { name: /Yanqiu Chen/ }));
    expect(onChange).toHaveBeenLastCalledWith(["user-1", "user-2"]);
  });

  it("keeps the selected organization as the search scope", async () => {
    render(<DirectoryUserPicker ariaLabel="授权用户" onChange={vi.fn()} />);

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "授权用户" }));
    fireEvent.click(await screen.findByText("Engineering"));
    const searchInput = await screen.findByRole("textbox", {
      name: "systemAdmin.userPicker.searchWithinDepartment:Engineering",
    });
    fireEvent.change(searchInput, { target: { value: "Yanqiu" } });

    await waitFor(() => {
      expect(mocks.listUsersPage).toHaveBeenCalledWith(
        expect.objectContaining({
          departmentId: "engineering",
          includeSubtree: true,
          search: "Yanqiu",
        }),
        { skipErrorToast: true },
      );
    });
  });

  it("does not show a truncation hint merely because unavailable users are filtered out", async () => {
    render(
      <DirectoryUserPicker
        ariaLabel="授权用户"
        disabledUserIds={["user-2"]}
        onChange={vi.fn()}
      />,
    );

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "授权用户" }));
    expect(await screen.findByRole("option", { name: /Mubai Li/ })).not.toBeNull();
    expect(screen.queryByText("systemAdmin.userPicker.refineSearch:100")).toBeNull();
    expect(screen.getByText("systemAdmin.userPicker.resultCount:1")).not.toBeNull();
  });

  it("shows the loaded range and an explicit fallback when more users are available", async () => {
    mocks.listUsersPage.mockResolvedValue({ total: 101, users });
    render(<DirectoryUserPicker ariaLabel="授权用户" onChange={vi.fn()} />);

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "授权用户" }));

    expect(await screen.findByRole("button", {
      name: "systemAdmin.userPicker.loadMore",
    })).not.toBeNull();
    expect(screen.getByText("systemAdmin.userPicker.resultRange:101")).not.toBeNull();
  });

  it("loads the next page when the user list reaches its bottom", async () => {
    mocks.listUsersPage
      .mockResolvedValueOnce({ total: 3, users })
      .mockResolvedValueOnce({ total: 3, users: [thirdUser] });
    render(<DirectoryUserPicker ariaLabel="授权用户" onChange={vi.fn()} />);

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "授权用户" }));
    const listbox = await screen.findByRole("listbox");
    Object.defineProperties(listbox, {
      clientHeight: { configurable: true, value: 200 },
      scrollHeight: { configurable: true, value: 400 },
      scrollTop: { configurable: true, value: 180 },
    });
    fireEvent.scroll(listbox);

    await waitFor(() => {
      expect(mocks.listUsersPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ limit: 100, offset: 2 }),
        { skipErrorToast: true },
      );
    });
    expect(await screen.findByRole("option", { name: /Zoe Lin/ })).not.toBeNull();
    expect(screen.queryByRole("button", {
      name: "systemAdmin.userPicker.loadMore",
    })).toBeNull();
  });

  it("renders compact organization and search controls above the inline user list", async () => {
    render(
      <DirectoryUserPicker
        ariaLabel="属性权限用户"
        onChange={vi.fn()}
        presentation="inline"
      />,
    );

    expect(screen.getByRole("group", { name: "属性权限用户" })).not.toBeNull();
    expect(screen.queryByRole("combobox", { name: "属性权限用户" })).toBeNull();
    expect(screen.getByRole("combobox", {
      name: "systemAdmin.userPicker.organizationScope",
    })).not.toBeNull();
    expect(screen.getByRole("textbox", {
      name: "systemAdmin.userPicker.searchAllUsers",
    })).not.toBeNull();
    expect(await screen.findByRole("option", { name: /Mubai Li/ })).not.toBeNull();
  });

  it("falls back to the flat searchable list when organization data is unavailable", async () => {
    mocks.listDepartments.mockRejectedValue(new Error("not available"));
    render(<DirectoryUserPicker ariaLabel="授权用户" onChange={vi.fn()} />);

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "授权用户" }));

    expect(await screen.findByText("systemAdmin.userPicker.organizationUnavailable")).not.toBeNull();
    expect(await screen.findByRole("option", { name: /Mubai Li/ })).not.toBeNull();
    expect(screen.queryByText("systemAdmin.userPicker.organization")).toBeNull();
  });
});
