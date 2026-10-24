/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import type { ConnectedClient } from "@/modules/api-keys/types/connected-client";

const API_PREFIX = "/safe/v1/me/oauth/clients";
const useMock = import.meta.env.VITE_USE_MOCK !== "false";

type BackendConnectedClient = {
  client_id: string;
  client_name?: string;
  redirect_uris?: string[];
  granted_at?: string | null;
  scopes?: string[];
};

function mapClient(item: BackendConnectedClient): ConnectedClient {
  return {
    clientId: item.client_id,
    clientName: item.client_name ?? "",
    redirectUris: item.redirect_uris ?? [],
    grantedAt: item.granted_at ?? null,
    scopes: item.scopes ?? [],
  };
}

const mockClients: BackendConnectedClient[] = [
  {
    client_id: "mock-workbuddy",
    client_name: "WorkBuddy Connector",
    redirect_uris: ["http://127.0.0.1:61503/oauth/callback"],
    granted_at: "2026-10-23T17:00:24+08:00",
    scopes: ["openid", "offline"],
  },
];

export async function listConnectedClients(): Promise<ConnectedClient[]> {
  if (useMock) {
    return mockClients.map(mapClient);
  }
  const response = await http.get<{ entries?: BackendConnectedClient[] }>(API_PREFIX);
  return (response.data.entries ?? []).map(mapClient);
}

/** Withdraws the user's grant: the client's tokens stop working and it must sign in again. */
export async function disconnectClient(clientId: string): Promise<void> {
  if (useMock) {
    const index = mockClients.findIndex((item) => item.client_id === clientId);
    if (index >= 0) {
      mockClients.splice(index, 1);
    }
    return;
  }
  await http.delete(`${API_PREFIX}/${encodeURIComponent(clientId)}`);
}
