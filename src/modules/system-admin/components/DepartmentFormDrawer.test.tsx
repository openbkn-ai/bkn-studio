/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminDepartment } from "@/modules/system-admin/types/admin";

const mocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  createDepartment: vi.fn(),
  updateDepartment: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: { error: mocks.error, success: mocks.success } }),
}));
vi.mock("@/modules/system-admin/services/admin.service", () => ({
  createDepartment: mocks.createDepartment,
  updateDepartment: mocks.updateDepartment,
}));
vi.mock("./DirectoryUserPicker", () => ({ DirectoryUserPicker: () => null }));

import { DepartmentFormDrawer } from "./DepartmentFormDrawer";

const departments: AdminDepartment[] = [
  { id: "root", name: "Root", parentId: null, type: "department" },
  { id: "child", name: "Child", parentId: "root", type: "department" },
  { id: "alt", name: "Alt", parentId: "child", type: "department" },
  { id: "leaf", name: "Leaf", parentId: "alt", type: "department" },
  { id: "sibling", name: "Sibling", parentId: "root", type: "department" },
];

describe("DepartmentFormDrawer parent selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("offers ancestors and siblings but excludes self, children and deep descendants", async () => {
    render(
      <DepartmentFormDrawer
        department={departments[1]}
        departments={departments}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        open
      />,
    );
    fireEvent.mouseDown(
      screen.getByRole("combobox", { name: "systemAdmin.users.deptDrawer.parent" }),
    );
    expect(await screen.findByText("Sibling")).toBeInTheDocument();
    expect(screen.queryByText("Child")).not.toBeInTheDocument();
    expect(screen.queryByText("Alt")).not.toBeInTheDocument();
    expect(screen.queryByText("Leaf")).not.toBeInTheDocument();
    expect(screen.getAllByText("Root").length).toBeGreaterThan(0);
  });

  it("shows a backend cycle rejection and keeps the editor open without reporting success", async () => {
    const description =
      "The parent department cannot be this department or one of its descendants.";
    mocks.updateDepartment.mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { error_code: "BknSafe.Department.Cycle", description } },
    });
    const onSaved = vi.fn();
    const onClose = vi.fn();
    render(
      <DepartmentFormDrawer
        department={departments[1]}
        departments={departments}
        onClose={onClose}
        onSaved={onSaved}
        open
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(description));
    expect(mocks.updateDepartment).toHaveBeenCalledWith(
      "child",
      expect.objectContaining({ parentId: "root" }),
    );
    expect(mocks.success).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
