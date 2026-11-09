/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useHref, useLocation, useMatch, useNavigate } from "react-router-dom";

import { CapabilityUpgradeDialog } from "@/framework/entitlement/CapabilityUpgradeDialog";
import { EditionBadge } from "@/framework/entitlement/EditionBadge";
import type { WorkspaceNavEntry, WorkspaceNavSection } from "@/framework/extension/registry";
import { buildReturnToState } from "@/modules/execution-factory/utils/back-navigation";
import {
  visibleWorkspaceExtensionEntries,
  type WorkspaceUpgradeEntry,
} from "@/modules/knowledge-network/scenes/workspace/workspaceExtensionEntries";
import { capabilityMinEdition } from "@/modules/subscription/capability-catalog";

import styles from "../KnowledgeNetworkWorkspaceScene.module.css";

/**
 * Sidebar entries another build registered for this network (see registry.ts). Under ability
 * verification they follow the Q&A and MCP entries, and the paid pages this build does not have
 * follow them; the analysis group lists only what was registered there.
 */
export function WorkspaceExtensionNavItems({
  activeKey,
  collapsed,
  hiddenKeys,
  networkId,
  section = "verification",
}: {
  /** The entry whose page the workspace shows. */
  activeKey?: string;
  collapsed: boolean;
  hiddenKeys?: readonly string[];
  networkId: string;
  section?: WorkspaceNavSection;
}) {
  const { items, upgrades } = visibleWorkspaceExtensionEntries(hiddenKeys, section);
  return (
    <>
      {items.map((item) => (
        <ExtensionNavItem
          active={item.key === activeKey}
          collapsed={collapsed}
          item={item}
          key={item.key}
          networkId={networkId}
        />
      ))}
      {upgrades.map((entry) => (
        <UpgradeNavItem collapsed={collapsed} entry={entry} key={entry.capability} />
      ))}
    </>
  );
}

function UpgradeNavItem({
  collapsed,
  entry,
}: {
  collapsed: boolean;
  entry: WorkspaceUpgradeEntry;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const minEdition = capabilityMinEdition(entry.capability) ?? "professional";
  const label = t(entry.labelKey);

  return (
    <>
      <button
        className={styles.sideItem}
        data-testid={`workspace-nav-upgrade-${entry.capability}`}
        onClick={() => setOpen(true)}
        title={label}
        type="button"
      >
        <span className={styles.sideItemMeta}>
          {entry.icon}
          {collapsed ? null : <span>{label}</span>}
        </span>
        {/* Always marked: this build lacks the page even where the licence covers it. */}
        {collapsed ? null : <EditionBadge alwaysShow edition={minEdition} />}
      </button>
      <CapabilityUpgradeDialog
        capability={entry.capability}
        minEdition={minEdition}
        // Only listed because this build lacks the page: a licence that covers it needs a
        // different frontend image, not a purchase.
        missingInFrontend
        onClose={() => setOpen(false)}
        open={open}
      />
    </>
  );
}

function ExtensionNavItem({
  active,
  collapsed,
  item,
  networkId,
}: {
  active: boolean;
  collapsed: boolean;
  item: WorkspaceNavEntry;
  networkId: string;
}) {
  const { t } = useTranslation();
  const location = useLocation();
  const href = useHref(item.path(networkId));
  const navigate = useNavigate();
  const match = useMatch({ path: item.path(networkId), end: false });
  const isActive = active || (item.openIn === "workspace" && Boolean(match));
  const label = t(item.labelKey);

  return (
    <button
      aria-current={isActive ? "page" : undefined}
      className={isActive ? styles.sideItemActive : styles.sideItem}
      data-testid={`workspace-nav-${item.id}`}
      onClick={() => {
        if (item.page || item.openIn === "workspace") {
          void navigate(item.path(networkId));
        } else if (item.openIn === "new-tab") {
          window.open(href, "_blank", "noopener,noreferrer");
        } else {
          // Standalone pages replace the workspace and receive the route used by their back button.
          void navigate(item.path(networkId), { state: buildReturnToState(location) });
        }
      }}
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
