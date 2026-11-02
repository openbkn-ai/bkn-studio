/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { CapabilityUpgradeDialog } from "@/framework/entitlement/CapabilityUpgradeDialog";
import { EditionBadge } from "@/framework/entitlement/EditionBadge";
import type { WorkspaceNavEntry } from "@/framework/extension/registry";
import { buildReturnToState } from "@/modules/execution-factory/utils/back-navigation";
import {
  visibleWorkspaceExtensionEntries,
  type WorkspaceUpgradeEntry,
} from "@/modules/knowledge-network/scenes/workspace/workspaceExtensionEntries";
import { capabilityMinEdition } from "@/modules/subscription/capability-catalog";

import styles from "../KnowledgeNetworkWorkspaceScene.module.css";

/**
 * Sidebar entries another build registered for this network (see registry.ts), listed under
 * ability verification after the Q&A and MCP entries, followed by the paid pages this build
 * does not have.
 */
export function WorkspaceExtensionNavItems({
  collapsed,
  hiddenKeys,
  networkId,
}: {
  collapsed: boolean;
  hiddenKeys?: readonly string[];
  networkId: string;
}) {
  const { items, upgrades } = visibleWorkspaceExtensionEntries(hiddenKeys);
  return (
    <>
      {items.map((item) => (
        <ExtensionNavItem collapsed={collapsed} item={item} key={item.key} networkId={networkId} />
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
  collapsed,
  item,
  networkId,
}: {
  collapsed: boolean;
  item: WorkspaceNavEntry;
  networkId: string;
}) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const label = t(item.labelKey);

  return (
    <button
      className={styles.sideItem}
      data-testid={`workspace-nav-${item.id}`}
      // In place, naming this page as the way back: the page has no workspace sidebar of its own.
      onClick={() => void navigate(item.path(networkId), { state: buildReturnToState(location) })}
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
