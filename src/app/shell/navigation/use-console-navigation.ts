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
  filterNavByEdition,
  filterNavByPermission,
} from "@/app/shell/console-navigation";
import type { ConsoleNavItem } from "@/app/shell/navigation/types";
import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import { useEntitlement } from "@/framework/entitlement/use-entitlement";
import { useLabFeatures } from "@/modules/execution-factory-lab/hooks/useLabFeatures";
import { isMarketCatalogEnabled } from "@/modules/execution-factory/utils/market-catalog";

export function useConsoleNavigation(): ConsoleNavItem[] {
  const { features } = useLabFeatures();
  const runtimeConfig = useRuntimeConfig();
  const entitlement = useEntitlement();

  return useMemo(
    () =>
      // 权限在前、档位在后:没权限的入口连"升级就能用"都不该暗示——那是别人的能力,
      // 不是自己少买了一档。
      filterNavByEdition(
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
        entitlement,
      ),
    [entitlement, features.catalog, runtimeConfig.currentUser.permissions],
  );
}
