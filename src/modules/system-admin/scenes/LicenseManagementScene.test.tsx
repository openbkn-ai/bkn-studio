/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LicenseDetail } from "@/modules/system-admin/types/license";

const deleteLicenseMock = vi.hoisted(() => vi.fn());
const getLicenseDetailMock = vi.hoisted(() => vi.fn());
const getLicenseFingerprintMock = vi.hoisted(() => vi.fn());
const messageMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }));
const modalConfirmMock = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ i18n: { language: "zh-CN" }, t: (key: string) => key }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: messageMock,
    modal: { confirm: modalConfirmMock },
  }),
}));

vi.mock("@/framework/entitlement/LicenseStateBanner", () => ({
  LicenseStateBanner: () => null,
}));

vi.mock("@/framework/entitlement/use-entitlement", () => ({
  useRefreshEntitlement: () => vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/framework/permission/PermissionGate", () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/modules/system-admin/services/license.service", () => ({
  activateLicense: vi.fn(),
  deleteLicense: deleteLicenseMock,
  getLicenseDetail: getLicenseDetailMock,
  getLicenseFingerprint: getLicenseFingerprintMock,
  importLicense: vi.fn(),
  resolveLicenseRequestErrorCode: vi.fn(),
}));

import { LicenseManagementScene } from "./LicenseManagementScene";

function licenseDetail(state: LicenseDetail["state"]): LicenseDetail {
  return {
    activated: false,
    edition: "community",
    features: [],
    instanceFp: "fp_001",
    limits: {},
    state,
  };
}

function renderScene(state: LicenseDetail["state"]) {
  getLicenseDetailMock.mockResolvedValue(licenseDetail(state));
  getLicenseFingerprintMock.mockResolvedValue("fp_001");

  render(
    <MemoryRouter>
      <LicenseManagementScene />
    </MemoryRouter>,
  );
}

const removeButtonName = /systemAdmin\.license\.delete$/;

describe("LicenseManagementScene", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteLicenseMock.mockResolvedValue(undefined);
  });

  it.each(["trial", "unlicensed"] as const)(
    "does not expose removal for the no-license %s state",
    async (state) => {
      renderScene(state);

      await waitFor(() => expect(getLicenseDetailMock).toHaveBeenCalledTimes(1));

      expect(screen.queryByRole("button", { name: removeButtonName })).toBeNull();
      expect(deleteLicenseMock).not.toHaveBeenCalled();
      expect(modalConfirmMock).not.toHaveBeenCalled();
      expect(messageMock.success).not.toHaveBeenCalledWith("systemAdmin.license.toast.deleted");
    },
  );

  it.each(["valid", "grace", "fallback_community", "invalid"] as const)(
    "keeps removal available for the installed-license %s state",
    async (state) => {
      renderScene(state);

      await waitFor(() => expect(getLicenseDetailMock).toHaveBeenCalledTimes(1));

      expect(screen.getByRole("button", { name: removeButtonName }).disabled).toBe(false);
    },
  );

  it("removes an invalid installed license and reports success", async () => {
    renderScene("invalid");

    const removeButton = await screen.findByRole("button", {
      name: removeButtonName,
    });
    fireEvent.click(removeButton);

    expect(modalConfirmMock).toHaveBeenCalledTimes(1);
    const [[{ onOk }]] = modalConfirmMock.mock.calls as [[{ onOk: () => Promise<void> }]];
    await act(async () => {
      await onOk();
    });

    expect(deleteLicenseMock).toHaveBeenCalledTimes(1);
    expect(messageMock.success).toHaveBeenCalledWith("systemAdmin.license.toast.deleted");
    await waitFor(() => expect(getLicenseDetailMock).toHaveBeenCalledTimes(2));
  });
});
