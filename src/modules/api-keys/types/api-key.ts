/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** 用户自助签发的 AppKey（长期凭据，bak_ 开头）。明文 key 仅签发/轮换时返回一次。 */
export type ApiKey = {
  id: string;
  keyId: string;
  name: string;
  /** 后端返回的掩码展示，如 bak_b3ff****b234（secret 不可回取）。 */
  masked: string;
  enabled: boolean;
  /** RFC3339；null = 永不过期。 */
  expiresAt: string | null;
  /** null = 从未使用。 */
  lastUsedAt: string | null;
  createdAt: string;
};

/** 签发 / 轮换的返回：在 ApiKey 基础上带一次性明文 key。 */
export type IssuedApiKey = ApiKey & { key: string };

export type IssueApiKeyPayload = {
  name: string;
  /** RFC3339；省略 = 默认 1 年。必须是将来时间。 */
  expiresAt?: string;
  /** true = 永不过期（优先级高于 expiresAt）。 */
  neverExpire?: boolean;
};
