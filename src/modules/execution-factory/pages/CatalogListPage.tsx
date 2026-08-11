/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Navigate, useLocation } from "react-router-dom";

import { CatalogListScene } from "@/modules/execution-factory/scenes/CatalogListScene";
import { isMarketCatalogEnabled } from "@/modules/execution-factory/utils/market-catalog";

export function CatalogListPage() {
  const location = useLocation();

  // When the marketplace entry is disabled, old bookmarks and direct URLs fall back to Execution Unit List while retaining activeTab.
  if (!isMarketCatalogEnabled()) {
    return <Navigate replace to={`/execution-factory/units${location.search}`} />;
  }

  return <CatalogListScene />;
}
