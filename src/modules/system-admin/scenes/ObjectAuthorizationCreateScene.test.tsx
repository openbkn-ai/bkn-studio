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
const upsertObjectGrantMock = vi.hoisted(() => vi.fn());
const capability = vi.hoisted((): { current: string } => ({ current: "available" }));

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

vi.mock("@/framework/entitlement/use-entitlement", () => ({
  useCapability: () => capability.current,
}));

vi.mock("@/framework/entitlement/RequireEdition", () => ({
  RequireEdition: () => <div>entitlement-state-unknown</div>,
}));

vi.mock("@/modules/system-admin/services/admin.service", () => ({
  listUsers: listUsersMock,
}));

vi.mock("@/modules/system-admin/services/authz.service", () => ({
  listAuthorizableObjects: listAuthorizableObjectsMock,
  upsertObjectGrant: upsertObjectGrantMock,
}));

vi.mock("@/modules/system-admin/services/authz-objects.service", () => ({
  resolveGrantNames: vi.fn(),
}));

import { ObjectAuthorizationCreateScene } from "./ObjectAuthorizationCreateScene";

describe("ObjectAuthorizationCreateScene object picker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capability.current = "available";
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

    expect(screen.getByText("systemAdmin.objectGrants.modeFineTitle")).not.toBeNull();
    expect(
      screen.getByLabelText("systemAdmin.objectGrants.authorizationModeHelp"),
    ).not.toBeNull();
    expect(screen.queryByText("systemAdmin.objectGrants.modeFineDescription")).toBeNull();
    expect(screen.getByRole("button", { name: /common\.back/ })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "common.cancel" })).toBeNull();
    expect(listAuthorizableObjectsMock).not.toHaveBeenCalled();

    const [typePicker] = screen.getAllByRole("combobox");
    fireEvent.mouseDown(typePicker);
    fireEvent.click(await screen.findByText("数据目录"));
    await act(async () => {});

    expect(listAuthorizableObjectsMock).toHaveBeenCalledWith("catalog");
  });

  it("omits model resources while keeping execution-factory resources", async () => {
    render(<ObjectAuthorizationCreateScene />);
    await act(async () => {});

    const [typePicker] = screen.getAllByRole("combobox");
    fireEvent.mouseDown(typePicker);

    const executionGroup = screen.getByText("systemAdmin.objectGrants.objectTypeGroups.execution");
    const operator = screen.getByText("函数集");

    expect(screen.queryByText("systemAdmin.objectGrants.objectTypeGroups.model")).toBeNull();
    expect(screen.queryByText("小模型")).toBeNull();
    expect(screen.queryByText("大模型")).toBeNull();
    expect(executionGroup.compareDocumentPosition(operator) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the operation code visible and explains a locked prerequisite separately", async () => {
    listAuthorizableObjectsMock.mockResolvedValue([
      { id: "operator-1", name: "Order settlement", type: "operator" },
    ]);
    render(<ObjectAuthorizationCreateScene />);
    await act(async () => {});

    const [typePicker] = screen.getAllByRole("combobox");
    fireEvent.mouseDown(typePicker);
    fireEvent.click(screen.getByText("函数集"));
    await act(async () => {});

    const [, objectPicker] = screen.getAllByRole("combobox");
    fireEvent.mouseDown(objectPicker);
    fireEvent.click(await screen.findByText("Order settlement"));

    const modifyButton = (await screen.findByText("modify")).closest("button");
    expect(modifyButton).not.toBeNull();
    fireEvent.click(modifyButton!);

    const viewCode = screen.getByText("view");
    const viewButton = viewCode.closest("button");
    expect(viewButton?.textContent).toContain("查看");
    expect(viewButton?.textContent).toContain("view");
    expect(viewButton?.textContent).not.toContain(
      "systemAdmin.objectGrants.requiredBySelection",
    );
    expect(
      screen.getByLabelText("systemAdmin.objectGrants.requiredBySelection"),
    ).not.toBeNull();
    expect(
      screen.getByText("systemAdmin.objectGrants.requiredSelectionNotice"),
    ).not.toBeNull();
  });

  it("keeps submission disabled until the live configuration summary is complete", async () => {
    listUsersMock.mockResolvedValue([
      { account: "li.mubai", id: "user-1", name: "Mubai Li" },
    ]);
    render(<ObjectAuthorizationCreateScene />);
    await act(async () => {});

    const confirmButton = screen.getByRole("button", {
      name: "systemAdmin.objectGrants.confirmGrant",
    });
    expect(confirmButton.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("systemAdmin.objectGrants.summaryNextPickObject")).not.toBeNull();

    const [typePicker] = screen.getAllByRole("combobox");
    fireEvent.mouseDown(typePicker);
    fireEvent.click(screen.getByText("数据目录"));
    await act(async () => {});

    const [, objectPicker] = screen.getAllByRole("combobox");
    fireEvent.mouseDown(objectPicker);
    fireEvent.click(await screen.findByText("Customer data"));

    const [, , granteePicker] = screen.getAllByRole("combobox");
    fireEvent.mouseDown(granteePicker);
    fireEvent.click(await screen.findByText("Mubai Li (li.mubai)"));

    expect(screen.getByText("systemAdmin.objectGrants.summaryReady")).not.toBeNull();
    expect(confirmButton.hasAttribute("disabled")).toBe(false);
  });

  it("falls back to the Community full-package mode and hides child resource types", async () => {
    capability.current = "not-installed";
    listUsersMock.mockResolvedValue([
      { account: "li.mubai", id: "user-1", name: "Mubai Li" },
    ]);
    render(<ObjectAuthorizationCreateScene />);
    await act(async () => {});

    expect(screen.getByText("systemAdmin.objectGrants.modeCommunityTitle")).not.toBeNull();
    const [typePicker] = screen.getAllByRole("combobox");
    fireEvent.mouseDown(typePicker);
    expect(screen.queryByText("数据资源")).toBeNull();
    expect(screen.queryByText("systemAdmin.objectGrants.effectDeny")).toBeNull();
    fireEvent.click(screen.getByText("数据目录"));
    await act(async () => {});

    const [, objectPicker] = screen.getAllByRole("combobox");
    fireEvent.mouseDown(objectPicker);
    fireEvent.click(await screen.findByText("Customer data"));

    const [, , granteePicker] = screen.getAllByRole("combobox");
    fireEvent.mouseDown(granteePicker);
    fireEvent.click(await screen.findByText("Mubai Li (li.mubai)"));

    const confirmButton = screen.getByRole("button", {
      name: "systemAdmin.objectGrants.confirmGrant",
    });
    const bundleButton = screen.getByRole("button", { name: /full_business_access/ });
    expect(bundleButton.getAttribute("aria-pressed")).toBe("false");
    expect(confirmButton.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("systemAdmin.objectGrants.grantNeedsBundle")).not.toBeNull();

    fireEvent.click(bundleButton);

    expect(bundleButton.getAttribute("aria-pressed")).toBe("true");
    expect(confirmButton.hasAttribute("disabled")).toBe(false);
    fireEvent.click(confirmButton);
    await act(async () => {});

    expect(upsertObjectGrantMock).toHaveBeenCalledWith({
      accessorId: "user-1",
      bundle: "full_business_access",
      objId: "catalog-1",
      objName: "Customer data",
      objSub: undefined,
      objType: "catalog",
    });
  });

  it("does not downgrade an unknown capability snapshot to Community grant creation", async () => {
    capability.current = "unknown";

    render(<ObjectAuthorizationCreateScene />);
    await act(async () => {});

    expect(screen.getByText("entitlement-state-unknown")).not.toBeNull();
    expect(screen.queryByText("systemAdmin.objectGrants.modeCommunityTitle")).toBeNull();
    expect(screen.queryByRole("button", { name: /full_business_access/ })).toBeNull();
    expect(screen.queryByRole("button", {
      name: "systemAdmin.objectGrants.confirmGrant",
    })).toBeNull();
    expect(upsertObjectGrantMock).not.toHaveBeenCalled();
  });
});
