/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CompassOutlined } from "@ant-design/icons";
import type { ReactNode } from "react";

import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { extensionWorkspaceNavItems, isExtensionInstalled } from "@/framework/extension/registry";

export type WorkspaceUpgradeEntry = { capability: string; icon: ReactNode; labelKey: string };

/**
 * Paid pages a build may lack. Where no installed extension brings one, the sidebar still names
 * it, marked with its edition, and opens the upgrade dialog instead of a page.
 */
const UPGRADE_ENTRIES: WorkspaceUpgradeEntry[] = [
  {
    capability: CAPABILITIES.GRAPH_EXPLORER,
    icon: <CompassOutlined />,
    labelKey: "knowledgeNetwork.workspaceGraphExplorer",
  },
];

/**
 * The extension and upgrade entries to show. `hiddenKeys` (RuntimeConfig.hiddenNavigation) leaves
 * out an extension entry by its key (`<extension id>:<entry id>`) and an upgrade entry by its
 * capability (for example `graph_explorer`).
 */
export function visibleWorkspaceExtensionEntries(hiddenKeys: readonly string[] = []) {
  return {
    items: extensionWorkspaceNavItems().filter((item) => !hiddenKeys.includes(item.key)),
    upgrades: UPGRADE_ENTRIES.filter(
      (entry) => !isExtensionInstalled(entry.capability) && !hiddenKeys.includes(entry.capability),
    ),
  };
}
