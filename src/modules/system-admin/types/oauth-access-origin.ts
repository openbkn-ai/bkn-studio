/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type OAuthAccessOriginSource = "deployment" | "runtime" | "system";

export type OAuthAccessOriginSyncState = "error" | "pending" | "synced";

export type OAuthAccessOriginDesiredState = "active" | "deleting";

export type OAuthAccessOrigin = {
  createdAt?: string;
  createdBy?: string;
  desiredState: OAuthAccessOriginDesiredState;
  id: string;
  lastSyncError?: string;
  origin: string;
  postLogoutRedirectUri: string;
  readOnly: boolean;
  redirectUri: string;
  source: OAuthAccessOriginSource;
  syncState: OAuthAccessOriginSyncState;
};

export type OAuthAccessOriginMutationResult = {
  entry?: OAuthAccessOrigin;
  pending: boolean;
};

export type OAuthAccessOriginRequestError =
  | { code: "conflict"; existingId?: string }
  | { code: "invalid" }
  | { code: "notFound" }
  | { code: "unknown" };
