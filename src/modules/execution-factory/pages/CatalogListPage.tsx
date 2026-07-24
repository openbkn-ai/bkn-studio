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

  // 市场入口未启用时,旧书签/直敲 URL 都落回执行单元列表(保留 activeTab)。
  if (!isMarketCatalogEnabled()) {
    return <Navigate replace to={`/execution-factory/units${location.search}`} />;
  }

  return <CatalogListScene />;
}
