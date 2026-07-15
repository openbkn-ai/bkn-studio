/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type LicenseState =
  | "fallback_community"
  | "grace"
  | "invalid"
  | "valid";

export type LicenseCustomer = {
  email?: string;
  name?: string;
  project?: string;
};

export type LicenseDetail = {
  activated: boolean;
  contractExpiresAt?: number;
  customer?: LicenseCustomer;
  edition: string;
  error?: string;
  expiresAt?: number;
  features: string[];
  graceRemainingDays?: number;
  instanceFp?: string;
  issuedAt?: number;
  licId?: string;
  limits: Record<string, number>;
  renewError?: string;
  state: LicenseState;
};

export type LicenseActivationCode = {
  activationCode: string;
  instanceFp: string;
  licId?: string;
};
