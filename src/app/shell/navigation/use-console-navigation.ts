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
  filterNavByCapability,
  filterNavByEdition,
  filterNavByPermission,
} from "@/app/shell/console-navigation";
import type { ConsoleNavItem } from "@/app/shell/navigation/types";
import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import { useEntitlementContext } from "@/framework/entitlement/use-entitlement";
import { useLabFeatures } from "@/modules/execution-factory-lab/hooks/useLabFeatures";
import { isMarketCatalogEnabled } from "@/modules/execution-factory/utils/market-catalog";

/**
 * 四层过滤,判据各不同源,都不能省:
 *
 *   开关 —— 本地/运行时 feature flag,与售卖无关
 *   权限 —— 这个人能不能(用户态)
 *   能力 —— 这套集群买没买某个已登记的付费能力(集群态,后端算好的结果)
 *   档位 —— 尚未登记 capability key 的付费面,退到档位判定(集群态)
 *
 * 权限在能力/档位之前:没权限的入口连「升级就能用」都不该暗示——那是别人的能力,不是
 * 自己少买了一档。
 *
 * 分成四个函数是刻意的:合并之后必然有人把 feature key、capability、minEdition、
 * permission 四种字符串混着传进同一个参数。
 */
export function useConsoleNavigation(): ConsoleNavItem[] {
  const { features } = useLabFeatures();
  const { snapshot } = useEntitlementContext();
  const runtimeConfig = useRuntimeConfig();

  return useMemo(
    () =>
      filterNavByEdition(
        filterNavByCapability(
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
          snapshot,
        ),
        snapshot,
      ),
    [features.catalog, runtimeConfig.currentUser.permissions, snapshot],
  );
}
