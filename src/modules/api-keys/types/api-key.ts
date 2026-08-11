/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** User-issued AppKey, a long-lived credential prefixed with bak_. The plaintext key is returned only once on issuance or rotation. */
export type ApiKey = {
  id: string;
  keyId: string;
  name: string;
  /** Masked display value returned by the backend, such as bak_b3ff****b234; the secret cannot be retrieved. */
  masked: string;
  enabled: boolean;
  /** RFC3339; null means never expires. */
  expiresAt: string | null;
  /** null means never used. */
  lastUsedAt: string | null;
  createdAt: string;
};

/** Issuance or rotation response: an ApiKey with a one-time plaintext key. */
export type IssuedApiKey = ApiKey & { key: string };

export type IssueApiKeyPayload = {
  name: string;
  /** RFC3339; omitted means one year by default. Must be in the future. */
  expiresAt?: string;
  /** true means never expires and takes precedence over expiresAt. */
  neverExpire?: boolean;
};
