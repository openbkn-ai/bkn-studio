/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import axios from "axios";

import { http } from "@/framework/request/http";
import type {
  OAuthAccessOrigin,
  OAuthAccessOriginDesiredState,
  OAuthAccessOriginMutationResult,
  OAuthAccessOriginRequestError,
  OAuthAccessOriginSource,
  OAuthAccessOriginSyncState,
} from "@/modules/system-admin/types/oauth-access-origin";

const ADMIN_ACCESS_ORIGINS = "/safe/v1/admin/oauth/access-origins";
const useMock = import.meta.env.VITE_USE_MOCK !== "false";

type BackendOAuthAccessOrigin = {
  created_at?: string;
  created_by?: string;
  desired_state?: OAuthAccessOriginDesiredState;
  id?: string;
  last_sync_error?: string;
  origin?: string;
  post_logout_redirect_uri?: string;
  read_only?: boolean;
  redirect_uri?: string;
  source?: OAuthAccessOriginSource;
  sync_state?: OAuthAccessOriginSyncState;
};

type BackendOAuthAccessOriginList = {
  entries?: BackendOAuthAccessOrigin[];
  total?: number;
};

export type OAuthAccessOriginReconcileResult = {
  entries: OAuthAccessOrigin[];
  pending: boolean;
};

type BackendErrorBody = {
  error_details?: {
    existing_id?: string;
  };
};

const wait = async <T>(value: T) =>
  new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(value), 160);
  });

let mockSequence = 1;
let mockOrigins: OAuthAccessOrigin[] = [
  {
    desiredState: "active",
    id: "system-primary",
    origin: "https://openbkn.example.com",
    postLogoutRedirectUri: "https://openbkn.example.com/studio",
    readOnly: true,
    redirectUri: "https://openbkn.example.com/studio/callback",
    source: "system",
    syncState: "synced",
  },
  {
    createdAt: new Date().toISOString(),
    createdBy: "demo-admin",
    desiredState: "active",
    id: "runtime-intranet",
    origin: "http://10.0.0.20:30080",
    postLogoutRedirectUri: "http://10.0.0.20:30080/studio",
    readOnly: false,
    redirectUri: "http://10.0.0.20:30080/studio/callback",
    source: "runtime",
    syncState: "synced",
  },
];

export function mapOAuthAccessOrigin(item: BackendOAuthAccessOrigin): OAuthAccessOrigin {
  return {
    createdAt: item.created_at,
    createdBy: item.created_by,
    desiredState: item.desired_state ?? "active",
    id: item.id ?? "",
    lastSyncError: item.last_sync_error,
    origin: item.origin ?? "",
    postLogoutRedirectUri: item.post_logout_redirect_uri ?? "",
    readOnly: item.read_only ?? true,
    redirectUri: item.redirect_uri ?? "",
    source: item.source ?? "runtime",
    syncState: item.sync_state ?? "pending",
  };
}

export function validateOAuthAccessOrigin(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("*")) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.hostname !== "" &&
      parsed.username === "" &&
      parsed.password === "" &&
      (parsed.pathname === "" || parsed.pathname === "/") &&
      parsed.search === "" &&
      parsed.hash === ""
    );
  } catch {
    return false;
  }
}

export function resolveOAuthAccessOriginError(error: unknown): OAuthAccessOriginRequestError {
  if (!axios.isAxiosError<BackendErrorBody>(error)) {
    return { code: "unknown" };
  }
  switch (error.response?.status) {
    case 400:
      return { code: "invalid" };
    case 404:
      return { code: "notFound" };
    case 409:
      return {
        code: "conflict",
        existingId: error.response.data?.error_details?.existing_id,
      };
    default:
      return { code: "unknown" };
  }
}

export async function listOAuthAccessOrigins(): Promise<OAuthAccessOrigin[]> {
  if (useMock) {
    return wait(mockOrigins.map((entry) => ({ ...entry })));
  }
  const response = await http.get<BackendOAuthAccessOriginList>(ADMIN_ACCESS_ORIGINS, {
    skipErrorToast: true,
  });
  return (response.data.entries ?? []).map(mapOAuthAccessOrigin);
}

export async function createOAuthAccessOrigin(
  origin: string,
): Promise<OAuthAccessOriginMutationResult> {
  if (useMock) {
    const normalized = new URL(origin.trim()).origin;
    if (mockOrigins.some((entry) => entry.origin === normalized)) {
      throw new Error("duplicate mock access origin");
    }
    const entry: OAuthAccessOrigin = {
      createdAt: new Date().toISOString(),
      createdBy: "demo-admin",
      desiredState: "active",
      id: `runtime-${mockSequence++}`,
      origin: normalized,
      postLogoutRedirectUri: `${normalized}/studio`,
      readOnly: false,
      redirectUri: `${normalized}/studio/callback`,
      source: "runtime",
      syncState: "synced",
    };
    mockOrigins = [...mockOrigins, entry];
    return wait({ entry: { ...entry }, pending: false });
  }
  const response = await http.post<BackendOAuthAccessOrigin>(
    ADMIN_ACCESS_ORIGINS,
    { origin: origin.trim() },
    { skipErrorToast: true },
  );
  return {
    entry: mapOAuthAccessOrigin(response.data),
    pending: response.status === 202,
  };
}

export async function deleteOAuthAccessOrigin(
  id: string,
): Promise<OAuthAccessOriginMutationResult> {
  if (useMock) {
    mockOrigins = mockOrigins.filter((entry) => entry.id !== id || entry.readOnly);
    return wait({ pending: false });
  }
  const response = await http.delete(`${ADMIN_ACCESS_ORIGINS}/${encodeURIComponent(id)}`, {
    skipErrorToast: true,
  });
  return { pending: response.status === 202 };
}

export async function reconcileOAuthAccessOrigins(): Promise<OAuthAccessOriginReconcileResult> {
  if (useMock) {
    mockOrigins = mockOrigins.map((entry) => ({
      ...entry,
      lastSyncError: undefined,
      syncState: "synced",
    }));
    return wait({ entries: mockOrigins.map((entry) => ({ ...entry })), pending: false });
  }
  const response = await http.post<BackendOAuthAccessOriginList>(
    `${ADMIN_ACCESS_ORIGINS}/reconcile`,
    undefined,
    { skipErrorToast: true },
  );
  return {
    entries: (response.data.entries ?? []).map(mapOAuthAccessOrigin),
    pending: response.status === 202,
  };
}
