/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProxyGovernanceAccount } from "@/modules/system-admin/types/proxy-governance";

const getPlanMock = vi.hoisted(() => vi.fn());
const listMock = vi.hoisted(() => vi.fn());
const reconcileMock = vi.hoisted(() => vi.fn());
const retryMock = vi.hoisted(() => vi.fn());
const messageMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
const modalConfirmMock = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: messageMock, modal: { confirm: modalConfirmMock } }),
}));

vi.mock("@/modules/system-admin/services/proxy-governance.service", () => ({
  getProxySyncPlan: getPlanMock,
  listProxyAccounts: listMock,
  reconcileProxyAccounts: reconcileMock,
  retryProxySync: retryMock,
}));

import { ProxyGovernanceScene } from "./ProxyGovernanceScene";

const failedAccount: ProxyGovernanceAccount = {
  createdAt: 1_700_000_000_000,
  knowledgeNetworkId: "kn-orders",
  lifecycleStatus: "active",
  proxyAccountId: "proxy-orders",
  proxyAccountType: "app",
  publishedModelVersion: "model-v2",
  syncStatus: "failed",
  syncedModelVersion: "model-v1",
  updatedAt: 1_700_000_100_000,
  version: 2,
};

describe("ProxyGovernanceScene", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: query,
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    });
    listMock.mockResolvedValue([failedAccount]);
    getPlanMock.mockResolvedValue({
      knowledgeNetworkId: "kn-orders",
      modelVersion: "model-v2",
      proxyAccountId: "proxy-orders",
      sources: [],
    });
    reconcileMock.mockResolvedValue({
      authorizationDrift: { "kn-orders": { added: 1 } },
      conflictingProxyAccounts: {},
      failedKnowledgeNetworkIds: [],
      missingMappings: ["kn-missing"],
      orphanMappings: [],
    });
    retryMock.mockResolvedValue({ ...failedAccount, syncStatus: "ready", syncedModelVersion: "model-v2" });
  });

  it("shows governed state and retries synchronization without accepting a target", async () => {
    render(<ProxyGovernanceScene />);

    expect(await screen.findByText("kn-orders")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /systemAdmin\.proxyGovernance\.retrySync/ }));

    await waitFor(() => expect(retryMock).toHaveBeenCalledWith("kn-orders"));
    expect(retryMock.mock.calls[0]).toHaveLength(1);
    expect(messageMock.success).toHaveBeenCalledWith("systemAdmin.proxyGovernance.toast.syncSucceeded");
  });

  it("requires confirmation before full reconciliation", async () => {
    render(<ProxyGovernanceScene />);
    await screen.findByText("kn-orders");

    fireEvent.click(screen.getByRole("button", { name: /systemAdmin\.proxyGovernance\.reconcile$/ }));
    expect(reconcileMock).not.toHaveBeenCalled();
    const [{ onOk }] = modalConfirmMock.mock.calls[0] as [{ onOk: () => Promise<void> }];
    await act(async () => onOk());

    expect(reconcileMock).toHaveBeenCalledTimes(1);
    expect(messageMock.success).toHaveBeenCalledWith("systemAdmin.proxyGovernance.toast.reconcileCompleted");
    expect(screen.getByText("kn-missing")).toBeTruthy();
    expect(screen.getByText("kn-orders: added 1")).toBeTruthy();
  });

  it("renders the empty state", async () => {
    listMock.mockResolvedValue([]);
    render(<ProxyGovernanceScene />);

    expect(await screen.findByText("systemAdmin.proxyGovernance.empty")).toBeTruthy();
  });

  it("shows a permission error without exposing backend details", async () => {
    listMock.mockRejectedValue({
      isAxiosError: true,
      response: {
        data: {
          description: "Proxy governance access denied",
          error_details: "proxy-hidden belongs to kn-hidden",
        },
        status: 403,
      },
    });
    render(<ProxyGovernanceScene />);

    expect(await screen.findByText("Proxy governance access denied")).toBeTruthy();
    expect(screen.queryByText("proxy-hidden belongs to kn-hidden")).toBeNull();
    expect(screen.getByRole("button", { name: /common\.retry/ })).toBeTruthy();
  });
});
