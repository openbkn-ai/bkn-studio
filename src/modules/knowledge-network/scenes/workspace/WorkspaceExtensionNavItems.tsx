/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useTranslation } from "react-i18next";
import { useHref } from "react-router-dom";

import { extensionWorkspaceNavItems, type WorkspaceNavEntry } from "@/framework/extension/registry";

import styles from "../KnowledgeNetworkWorkspaceScene.module.css";

/**
 * Sidebar entries another build registered for this network (see registry.ts), listed under
 * ability verification after the Q&A and MCP entries. The community build registers none, so
 * nothing renders.
 */
export function WorkspaceExtensionNavItems({
  collapsed,
  networkId,
}: {
  collapsed: boolean;
  networkId: string;
}) {
  return extensionWorkspaceNavItems().map((item) => (
    <ExtensionNavItem collapsed={collapsed} item={item} key={item.key} networkId={networkId} />
  ));
}

function ExtensionNavItem({
  collapsed,
  item,
  networkId,
}: {
  collapsed: boolean;
  item: WorkspaceNavEntry;
  networkId: string;
}) {
  const { t } = useTranslation();
  const href = useHref(item.path(networkId));
  const label = t(item.labelKey);

  return (
    <button
      className={styles.sideItem}
      data-testid={`workspace-nav-${item.id}`}
      onClick={() => window.open(href, "_blank", "noopener,noreferrer")}
      title={label}
      type="button"
    >
      <span className={styles.sideItemMeta}>
        {item.icon}
        {collapsed ? null : <span>{label}</span>}
      </span>
    </button>
  );
}
