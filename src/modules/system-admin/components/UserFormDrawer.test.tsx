/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminUser } from "@/modules/system-admin/types/admin";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
  createUser: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en-US" } }),
}));
vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: { error: mocks.error, success: mocks.success } }),
}));
vi.mock("@/modules/system-admin/services/admin.service", () => ({
  getUser: mocks.getUser,
  updateUser: mocks.updateUser,
  createUser: mocks.createUser,
}));
import { UserFormDrawer } from "./UserFormDrawer";
const user: AdminUser = {
  id: "external",
  account: "external-account",
  name: "External",
  source: "sso",
  email: "external@example.com",
  telephone: "1234",
  accountType: "other",
  enabled: true,
  roleIds: [],
  departmentIds: [],
};

describe("UserFormDrawer external profiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue(user);
    mocks.updateUser.mockResolvedValue(undefined);
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });
  it("keeps source profile read-only while allowing a department-only update", async () => {
    render(
      <UserFormDrawer user={user} departments={[]} onClose={vi.fn()} onSaved={vi.fn()} open />,
    );
    await waitFor(() => expect(mocks.getUser).toHaveBeenCalled());
    expect(screen.getByLabelText("systemAdmin.users.drawer.displayName")).toBeDisabled();
    expect(screen.getByDisplayValue(user.email)).toBeDisabled();
    expect(screen.getByDisplayValue(user.telephone)).toBeDisabled();
    expect(screen.getByText("systemAdmin.users.externalProfileHint")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));
    await waitFor(() =>
      expect(mocks.updateUser).toHaveBeenCalledWith(
        user.id,
        { departmentIds: [] },
        { skipErrorToast: true },
      ),
    );
  });
  it("keeps local profile fields editable", () => {
    const local = { ...user, source: "local" };
    mocks.getUser.mockResolvedValue(local);
    render(
      <UserFormDrawer user={local} departments={[]} onClose={vi.fn()} onSaved={vi.fn()} open />,
    );
    expect(screen.getByLabelText("systemAdmin.users.drawer.displayName")).toBeEnabled();
    expect(screen.getByDisplayValue(local.email)).toBeEnabled();
    expect(screen.queryByText("systemAdmin.users.externalProfileHint")).not.toBeInTheDocument();
  });
});
