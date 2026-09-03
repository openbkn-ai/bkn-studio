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
 * Apply three independent filters: local feature flags, user permissions, and cluster
 * capabilities. Capability availability is calculated by the server; the client does not infer
 * it from edition ordering.
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
            // Keep the execution-factory menu visible; it no longer follows the capabilities-lab
            // hide_legacy_execution_factory_menu flag.
            hideLegacyExecutionFactory: false,
            // The market catalog is not enabled yet and overlaps with Execution Unit Management.
            hideMarketCatalog: !isMarketCatalogEnabled(),
          }),
          runtimeConfig.currentUser.permissions,
          runtimeConfig.currentUser.roles,
        ),
        snapshot,
      ),
    [features.catalog, runtimeConfig.currentUser.permissions, runtimeConfig.currentUser.roles, snapshot],
  );
}
