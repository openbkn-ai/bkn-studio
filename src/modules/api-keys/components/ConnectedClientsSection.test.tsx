/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ConnectedClient } from "@/modules/api-keys/types/connected-client";

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

vi.mock("@/modules/api-keys/services/connected-client.service", () => ({
  disconnectClient: disconnectMock,
  listConnectedClients: listMock,
}));

import { ConnectedClientsSection } from "./ConnectedClientsSection";

const workBuddy: ConnectedClient = {
  clientId: "f61c37c9",
  clientName: "WorkBuddy Connector",
  grantedAt: "2026-10-23T09:00:24Z",
  redirectUris: ["http://127.0.0.1:61503/oauth/callback"],
  scopes: ["openid", "offline"],
};

describe("ConnectedClientsSection", () => {
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

  it("lists the clients the user connected, with where each one calls back", async () => {
    listMock.mockResolvedValue([workBuddy]);
    render(<ConnectedClientsSection />);

    expect(await screen.findByText("WorkBuddy Connector")).toBeInTheDocument();
    expect(screen.getByText("127.0.0.1:61503")).toBeInTheDocument();
    expect(screen.getByText("apiKeys.connectedClients.description")).toBeInTheDocument();
  });

  it("disconnects a client after confirmation and reloads the list", async () => {
    listMock.mockResolvedValueOnce([workBuddy]).mockResolvedValueOnce([]);
    disconnectMock.mockResolvedValue(undefined);
    render(<ConnectedClientsSection />);

    (await screen.findByText("apiKeys.connectedClients.actionDisconnect")).click();
    expect(modalConfirmMock).toHaveBeenCalledTimes(1);
    const { onOk } = modalConfirmMock.mock.calls[0][0] as { onOk: () => Promise<void> };
    await onOk();

    expect(disconnectMock).toHaveBeenCalledWith("f61c37c9");
    expect(messageMock.success).toHaveBeenCalledWith("apiKeys.connectedClients.disconnectSuccess");
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
  });

  it("shows the empty state when nothing is connected", async () => {
    listMock.mockResolvedValue([]);
    render(<ConnectedClientsSection />);
    expect(await screen.findByText("apiKeys.connectedClients.emptyTitle")).toBeInTheDocument();
  });

  it("offers a retry when the list cannot be loaded", async () => {
    listMock.mockRejectedValue(new Error("boom"));
    render(<ConnectedClientsSection />);
    expect(await screen.findByText("common.retry")).toBeInTheDocument();
  });
});
