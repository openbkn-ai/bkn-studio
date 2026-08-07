/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { LicenseState } from "@/framework/entitlement/types";

/**
 * 授权状态。**单一源是 framework/entitlement**——同一个 licverify 六态,产品里不该有
 * 第二份定义:这里少了 `trial` 与 `unlicensed`,后端返回那两个时会静默落到「未知状态」,
 * 而它们恰好是无证部署最常见的两种。
 *
 * 这份别名留着是为了不改动本模块几十处引用,类型本身不再自己列。
 */
export type { LicenseState };

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
