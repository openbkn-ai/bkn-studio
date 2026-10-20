/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ApartmentOutlined } from "@ant-design/icons";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useHref } from "react-router-dom";

import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { CapabilityUpgradeDialog } from "@/framework/entitlement/CapabilityUpgradeDialog";
import { EditionBadge } from "@/framework/entitlement/EditionBadge";
import {
  extensionWorkspaceNavItems,
  isExtensionInstalled,
  type WorkspaceNavEntry,
} from "@/framework/extension/registry";
import { capabilityMinEdition } from "@/modules/subscription/capability-catalog";

import styles from "../KnowledgeNetworkWorkspaceScene.module.css";

/**
 * Paid pages a build may lack. Where no installed extension brings one, the sidebar still names
 * it, marked with its edition, and opens the upgrade dialog instead of a page.
 */
const UPGRADE_ENTRIES: { capability: string; icon: ReactNode; labelKey: string }[] = [
  {
    capability: CAPABILITIES.GRAPH_EXPLORER,
    icon: <ApartmentOutlined />,
    labelKey: "knowledgeNetwork.workspaceGraphExplorer",
  },
];

/**
 * Sidebar entries another build registered for this network (see registry.ts), listed under
 * ability verification after the Q&A and MCP entries, followed by the paid pages this build
 * does not have.
 */
export function WorkspaceExtensionNavItems({
  collapsed,
  networkId,
}: {
  collapsed: boolean;
  networkId: string;
}) {
  return (
    <>
      {extensionWorkspaceNavItems().map((item) => (
        <ExtensionNavItem collapsed={collapsed} item={item} key={item.key} networkId={networkId} />
      ))}
      {UPGRADE_ENTRIES.filter((entry) => !isExtensionInstalled(entry.capability)).map((entry) => (
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
  entry: (typeof UPGRADE_ENTRIES)[number];
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
