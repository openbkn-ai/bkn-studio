/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useMemo } from "react";

import {
  consoleNavigation,
  filterConsoleNavigation,
  filterNavByPermission,
} from "@/app/shell/console-navigation";
import type { ConsoleNavItem } from "@/app/shell/navigation/types";
import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import { useLabFeatures } from "@/modules/execution-factory-lab/hooks/useLabFeatures";
import { isMarketCatalogEnabled } from "@/modules/execution-factory/utils/market-catalog";

export function useConsoleNavigation(): ConsoleNavItem[] {
  const { features } = useLabFeatures();
  const runtimeConfig = useRuntimeConfig();

  return useMemo(
    () =>
      filterNavByPermission(
        filterConsoleNavigation(consoleNavigation, {
          hideCatalog: !features.catalog,
          // 执行工厂菜单常驻:不再跟随 capabilities-lab 的
          // hide_legacy_execution_factory_menu 开关隐藏。
          hideLegacyExecutionFactory: false,
          // 跨业务域市场暂未启用,入口与"执行单元管理"内容重叠。
          hideMarketCatalog: !isMarketCatalogEnabled(),
        }),
        runtimeConfig.currentUser.permissions,
      ),
    [features.catalog, runtimeConfig.currentUser.permissions],
  );
}
