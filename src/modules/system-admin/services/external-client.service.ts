/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import type { ExternalClient } from "@/modules/system-admin/types/external-client";

const ADMIN_CLIENTS = "/safe/v1/admin/oauth/clients";
const useMock = import.meta.env.VITE_USE_MOCK !== "false";

type BackendExternalClient = {
  client_id: string;
  client_name?: string;
  redirect_uris?: string[];
  registered_at?: string | null;
  registered_from?: string;
};

function mapClient(item: BackendExternalClient): ExternalClient {
  return {
    clientId: item.client_id,
    clientName: item.client_name ?? "",
    redirectUris: item.redirect_uris ?? [],
    registeredAt: item.registered_at ?? null,
    registeredFrom: item.registered_from ?? "",
  };
}

const mockClients: BackendExternalClient[] = [
  {
    client_id: "mock-workbuddy",
    client_name: "WorkBuddy Connector",
    redirect_uris: ["http://127.0.0.1:61503/oauth/callback"],
    registered_at: "2026-10-23T16:59:56+08:00",
    registered_from: "10.211.55.2",
  },
];

export async function listExternalClients(): Promise<ExternalClient[]> {
  if (useMock) {
    return mockClients.map(mapClient);
  }
  const response = await http.get<{ entries?: BackendExternalClient[] }>(ADMIN_CLIENTS);
  return (response.data.entries ?? []).map(mapClient);
}

/** Removes the client; every user's access through it ends. */
export async function removeExternalClient(clientId: string): Promise<void> {
  if (useMock) {
    const index = mockClients.findIndex((item) => item.client_id === clientId);
    if (index >= 0) {
      mockClients.splice(index, 1);
    }
    return;
  }
  await http.delete(`${ADMIN_CLIENTS}/${encodeURIComponent(clientId)}`);
}
