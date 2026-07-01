/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { CatalogListSceneProps } from "@/modules/execution-factory/contracts/scenes";
import {
  getDefaultManagementTab,
  getManagementTabs,
} from "@/modules/execution-factory/utils/capability-ux";

import { ExecutionUnitListScene } from "./ExecutionUnitListScene";

export function CatalogListScene({ defaultKeyword }: CatalogListSceneProps) {
  return (
    <ExecutionUnitListScene
      defaultKeyword={defaultKeyword}
      defaultTab={getDefaultManagementTab()}
      descriptionKey="executionFactory.catalogDescription"
      marketMode
      tabs={getManagementTabs()}
      titleKey="executionFactory.catalogTitle"
      toolbarHintKey="executionFactory.catalogToolbarHint"
    />
  );
}
