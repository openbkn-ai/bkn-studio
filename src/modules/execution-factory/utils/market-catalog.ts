/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { getRuntimeConfig } from "@/framework/runtime/config";

function readEnvMarketCatalog(): boolean | undefined {
  const env = import.meta.env as Record<string, string | undefined>;
  const raw = env.VITE_MARKET_CATALOG;
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  return undefined;
}

/**
 * Market catalog for browsing and installing shared resources. Off by default:
 * the current deployment exposes the same records as the management list, so the
 * extra nav entry only adds confusion. The route and marketMode code paths stay
 * in place for a future shared catalog with records distinct from local management.
 */
export function isMarketCatalogEnabled(): boolean {
  const runtimeFlag = getRuntimeConfig().features?.marketCatalog;
  if (typeof runtimeFlag === "boolean") {
    return runtimeFlag;
  }

  const envFlag = readEnvMarketCatalog();
  if (typeof envFlag === "boolean") {
    return envFlag;
  }

  return false;
}
