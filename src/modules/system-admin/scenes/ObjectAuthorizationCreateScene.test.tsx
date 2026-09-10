/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listAuthorizableObjectsMock = vi.hoisted(() => vi.fn());
const listUsersMock = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ i18n: { language: "zh-CN" }, t: (key: string) => key }),
}));

vi.mock("react-router-dom", () => ({
  useLocation: () => ({ state: null }),
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams()],
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { error: vi.fn(), success: vi.fn() },
    runtimeConfig: { currentUser: { permissions: ["admin-authz:grant"] } },
  }),
}));

vi.mock("@/modules/system-admin/services/admin.service", () => ({
  listUsers: listUsersMock,
}));

vi.mock("@/modules/system-admin/services/authz.service", () => ({
  listAuthorizableObjects: listAuthorizableObjectsMock,
  upsertObjectGrant: vi.fn(),
}));

vi.mock("@/modules/system-admin/services/authz-objects.service", () => ({
  resolveGrantNames: vi.fn(),
}));

import { ObjectAuthorizationCreateScene } from "./ObjectAuthorizationCreateScene";

describe("ObjectAuthorizationCreateScene object picker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listUsersMock.mockResolvedValue([]);
    listAuthorizableObjectsMock.mockResolvedValue([
      { id: "catalog-1", name: "Customer data", type: "catalog" },
    ]);
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

  it("loads objects only after a resource type is selected", async () => {
    render(<ObjectAuthorizationCreateScene />);
    await act(async () => {});

    expect(listAuthorizableObjectsMock).not.toHaveBeenCalled();

    const [typePicker] = screen.getAllByRole("combobox");
    fireEvent.mouseDown(typePicker);
    fireEvent.click(await screen.findByText("数据目录"));
    await act(async () => {});

    expect(listAuthorizableObjectsMock).toHaveBeenCalledWith("catalog");
  });
});
