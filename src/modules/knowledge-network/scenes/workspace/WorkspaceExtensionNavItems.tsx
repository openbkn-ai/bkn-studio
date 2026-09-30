/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useTranslation } from "react-i18next";
import { useHref } from "react-router-dom";

import { extensionWorkspaceActions, type WorkspaceAction } from "@/framework/extension/registry";

import styles from "../KnowledgeNetworkWorkspaceScene.module.css";

/**
 * Pages another build registered for this network (see registry.ts), listed under ability
 * verification beside the Q&A and MCP entries. They open in a new tab like the overview buttons
 * do: such a page stands on its own, without this sidebar to come back through. The community
 * build registers none, so nothing renders.
 */
export function WorkspaceExtensionNavItems({
  collapsed,
  networkId,
}: {
  collapsed: boolean;
  networkId: string;
}) {
  return extensionWorkspaceActions().map((action) => (
    <ExtensionNavItem
      action={action}
      collapsed={collapsed}
      key={action.key}
      networkId={networkId}
    />
  ));
}

function ExtensionNavItem({
  action,
  collapsed,
  networkId,
}: {
  action: WorkspaceAction;
  collapsed: boolean;
  networkId: string;
}) {
  const { t } = useTranslation();
  const href = useHref(action.path(networkId));
  const label = t(action.labelKey);

  return (
    <button
      className={styles.sideItem}
      data-testid={`workspace-nav-${action.id}`}
      onClick={() => window.open(href, "_blank", "noopener,noreferrer")}
      title={label}
      type="button"
    >
      <span className={styles.sideItemMeta}>
        {action.icon}
        {collapsed ? null : <span>{label}</span>}
      </span>
    </button>
  );
}
