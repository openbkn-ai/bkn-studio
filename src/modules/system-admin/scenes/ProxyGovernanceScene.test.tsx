/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ProxyGovernanceAccount,
  ProxySyncPlan,
} from "@/modules/system-admin/types/proxy-governance";

const getPlanMock = vi.hoisted(() => vi.fn());
const listMock = vi.hoisted(() => vi.fn());
const reconcileMock = vi.hoisted(() => vi.fn());
const retryMock = vi.hoisted(() => vi.fn());
const messageMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
const modalConfirmMock = vi.hoisted(() => vi.fn());
const permissionState = vi.hoisted(() => ({ current: [] as string[] }));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: messageMock,
    modal: { confirm: modalConfirmMock },
    runtimeConfig: { currentUser: { permissions: permissionState.current } },
  }),
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("ProxyGovernanceScene", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissionState.current = ["admin-authz:grant", "admin-authz:revoke"];
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

  it("keeps write actions hidden from read-only authorization reviewers", async () => {
    permissionState.current = ["admin-authz:view"];
    render(<ProxyGovernanceScene />);

    expect(await screen.findByText("kn-orders")).toBeTruthy();
    expect(screen.getByRole("button", {
      name: /systemAdmin\.proxyGovernance\.viewSources/,
    })).toBeTruthy();
    expect(screen.queryByRole("button", {
      name: /systemAdmin\.proxyGovernance\.retrySync/,
    })).toBeNull();
    expect(screen.queryByRole("button", {
      name: /systemAdmin\.proxyGovernance\.reconcile$/,
    })).toBeNull();
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

  it("discards a late grant-source plan after another network is opened", async () => {
    const planA = deferred<ProxySyncPlan>();
    const planB = deferred<ProxySyncPlan>();
    listMock.mockResolvedValue([
      failedAccount,
      {
        ...failedAccount,
        knowledgeNetworkId: "kn-customers",
        proxyAccountId: "proxy-customers",
      },
    ]);
    getPlanMock.mockImplementation((knowledgeNetworkId: string) =>
      knowledgeNetworkId === "kn-orders" ? planA.promise : planB.promise);
    render(<ProxyGovernanceScene />);

    await screen.findByText("kn-customers");
    const openButtons = screen.getAllByRole("button", {
      name: /systemAdmin\.proxyGovernance\.viewSources/,
    });
    fireEvent.click(openButtons[0]);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(openButtons[1]);

    await act(async () => {
      planA.resolve({
        knowledgeNetworkId: "kn-orders",
        modelVersion: "model-a",
        proxyAccountId: "proxy-orders",
        sources: [{
          bindingId: "binding-a",
          bindingType: "object_type",
          knowledgeNetworkId: "kn-orders",
          operation: "view",
          resourceId: "resource-a",
          resourceType: "catalog",
          sourceId: "binding-a",
          sourceType: "kn_proxy_binding",
        }],
      });
      await planA.promise;
    });
    expect(screen.queryByText("resource-a")).toBeNull();

    await act(async () => {
      planB.resolve({
        knowledgeNetworkId: "kn-customers",
        modelVersion: "model-b",
        proxyAccountId: "proxy-customers",
        sources: [{
          bindingId: "binding-b",
          bindingType: "object_type",
          knowledgeNetworkId: "kn-customers",
          operation: "view",
          resourceId: "resource-b",
          resourceType: "catalog",
          sourceId: "binding-b",
          sourceType: "kn_proxy_binding",
        }],
      });
      await planB.promise;
    });
    expect(await screen.findByText("resource-b")).toBeTruthy();
    expect(screen.queryByText("resource-a")).toBeNull();
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
