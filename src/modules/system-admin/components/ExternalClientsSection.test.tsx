/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExternalClient } from "@/modules/system-admin/types/external-client";

const listMock = vi.hoisted(() => vi.fn());
const disconnectMock = vi.hoisted(() => vi.fn());
const messageMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
const modalConfirmMock = vi.hoisted(() => vi.fn());
// Stable like the real `t`: the section reloads whenever `t` changes identity.
const translate = vi.hoisted(() => (key: string) => key);

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: translate }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: messageMock, modal: { confirm: modalConfirmMock } }),
}));

vi.mock("@/modules/system-admin/services/external-client.service", () => ({
  listExternalClients: listMock,
  removeExternalClient: disconnectMock,
}));

import { ExternalClientsSection } from "./ExternalClientsSection";

const workBuddy: ExternalClient = {
  clientId: "f61c37c9",
  clientName: "WorkBuddy Connector",
  redirectUris: ["http://127.0.0.1:61503/oauth/callback"],
  registeredAt: "2026-10-23T08:59:56Z",
  registeredFrom: "10.211.55.2",
};

describe("ExternalClientsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ant Design's responsive table observes media queries; jsdom has none.
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: query,
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    );
  });

  it("lists every self-registered client with where it registered from", async () => {
    listMock.mockResolvedValue([workBuddy]);
    render(<ExternalClientsSection />);

    expect(await screen.findByText("WorkBuddy Connector")).toBeInTheDocument();
    expect(screen.getByText("http://127.0.0.1:61503/oauth/callback")).toBeInTheDocument();
    expect(screen.getByText("10.211.55.2")).toBeInTheDocument();
  });

  it("removes a client after confirmation and reloads the list", async () => {
    listMock.mockResolvedValueOnce([workBuddy]).mockResolvedValueOnce([]);
    disconnectMock.mockResolvedValue(undefined);
    render(<ExternalClientsSection />);

    (await screen.findByText("systemAdmin.externalClients.actionRemove")).click();
    expect(modalConfirmMock).toHaveBeenCalledTimes(1);
    const { onOk } = modalConfirmMock.mock.calls[0][0] as { onOk: () => Promise<void> };
    await onOk();

    expect(disconnectMock).toHaveBeenCalledWith("f61c37c9");
    expect(messageMock.success).toHaveBeenCalledWith("systemAdmin.externalClients.removeSuccess");
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
  });

  it("shows the empty state when no client has registered", async () => {
    listMock.mockResolvedValue([]);
    render(<ExternalClientsSection />);
    expect(await screen.findByText("systemAdmin.externalClients.empty")).toBeInTheDocument();
  });

  it("offers a retry when the list cannot be loaded", async () => {
    listMock.mockRejectedValue(new Error("boom"));
    render(<ExternalClientsSection />);
    expect(await screen.findByText("common.retry")).toBeInTheDocument();
  });
});
