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
  filterNavByPermission,
} from "@/app/shell/console-navigation";
import type { ConsoleNavItem } from "@/app/shell/navigation/types";
import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import { useEntitlementContext } from "@/framework/entitlement/use-entitlement";
import { useLabFeatures } from "@/modules/execution-factory-lab/hooks/useLabFeatures";
import { isMarketCatalogEnabled } from "@/modules/execution-factory/utils/market-catalog";

/**
 * 三层过滤,判据各不同源,都不能省:
 *
 *   开关 —— 本地/运行时 feature flag,与售卖无关
 *   权限 —— 这个人能不能(用户态)
 *   能力 —— 这套集群买没买(集群态)
 *
 * **档位不在这里判。** 前端不推档位:`capabilities[]` 是服务端用 `AtLeast(MinEdition)`
 * 从装配表算好的结果,前端照读即可(ee-design.md §3.2「不让客户端自己推」、§6.1
 * 「Studio 只消费这一条聚合接口」)。在前端复制一份档位序,是 licensing README 点名的
 * 唯一大错——两处对「industry 是否高于 enterprise」给出不同答案。
 *
 * 分成三个函数是刻意的:合并之后必然有人把 feature flag、capability、permission 三种
 * 字符串混着传进同一个参数。
 */
export function useConsoleNavigation(): ConsoleNavItem[] {
  const { features } = useLabFeatures();
  const { snapshot } = useEntitlementContext();
  const runtimeConfig = useRuntimeConfig();

  return useMemo(
    () =>
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
    [features.catalog, runtimeConfig.currentUser.permissions, snapshot],
  );
}
