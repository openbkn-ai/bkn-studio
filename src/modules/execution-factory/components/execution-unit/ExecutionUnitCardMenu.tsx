/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DownloadOutlined, MoreOutlined, SyncOutlined } from "@ant-design/icons";
import { Dropdown, Tag } from "antd";
import type { MenuProps } from "antd";
import { useTranslation } from "react-i18next";

import { PermissionGate } from "@/framework/permission/PermissionGate";
import { AppButton } from "@/framework/ui/common/AppButton";
import { getExecutionUnitLifecycleActions } from "@/modules/execution-factory/utils/execution-unit-lifecycle";

import type { ExecutionUnitCardItem, ExecutionUnitTab } from "./types";

import styles from "./ExecutionUnitCard.module.css";

export type ExecutionUnitCardAction =
  | "view"
  | "edit"
  | "export"
  | "download"
  | "updatePackage"
  | "publish"
  | "offline"
  | "delete"
  | "install"
  | "authorize";

type ExecutionUnitCardMenuProps = {
  activeTab: ExecutionUnitTab;
  installedStateReady?: boolean;
  item: ExecutionUnitCardItem;
  marketMode?: boolean;
  onAction: (action: ExecutionUnitCardAction, item: ExecutionUnitCardItem) => void;
};

function getInstallPermission() {
  return "execution-factory:catalog:install";
}

function pushMenuAction(
  menuItems: MenuProps["items"],
  key: string,
  label: string,
  onAction: ExecutionUnitCardMenuProps["onAction"],
  action: ExecutionUnitCardAction,
  item: ExecutionUnitCardItem,
  options?: { danger?: boolean; disabled?: boolean; disabledReason?: string },
) {
  menuItems?.push({
    key,
    danger: options?.danger,
    disabled: options?.disabled,
    label: options?.disabledReason ? <span title={options.disabledReason}>{label}</span> : label,
    onClick: ({ domEvent }) => {
      domEvent.stopPropagation();
      if (options?.disabled) {
        return;
      }
      onAction(action, item);
    },
  });
}

export function ExecutionUnitCardMenu({
  activeTab,
  installedStateReady = true,
  item,
  marketMode = false,
  onAction,
}: ExecutionUnitCardMenuProps) {
  const { t } = useTranslation();

  if (marketMode) {
    const permission = getInstallPermission();
    const installedInDomain = installedStateReady && item.installedInDomain === true;

    return (
      <PermissionGate permissions={permission}>
        <div className={styles.marketActionGroup}>
          {installedInDomain ? (
            <Tag className={styles.installedTag} color="success">
              {t("executionFactory.marketIntroducedTag")}
            </Tag>
          ) : null}
          <AppButton
            className={styles.cardInstallButton}
            icon={installedInDomain ? <SyncOutlined /> : <DownloadOutlined />}
            loading={!installedStateReady}
            onClick={(event) => {
              event.stopPropagation();
              onAction("install", item);
            }}
            size="small"
            type={installedInDomain ? "default" : "primary"}
          >
            {t(installedInDomain ? "executionFactory.marketSync" : "executionFactory.marketIntroduce")}
          </AppButton>
        </div>
      </PermissionGate>
    );
  }

  const menuItems: MenuProps["items"] = [];

  if (activeTab === "operator") {
    pushMenuAction(
      menuItems,
      "view",
      t("executionFactory.cardMenu.view"),
      onAction,
      "view",
      item,
    );
    pushMenuAction(
      menuItems,
      "edit",
      t("executionFactory.cardMenu.edit"),
      onAction,
      "edit",
      item,
    );
  }

  if (activeTab === "toolbox") {
    pushMenuAction(
      menuItems,
      "view",
      t("executionFactory.cardMenu.view"),
      onAction,
      "view",
      item,
    );
    pushMenuAction(
      menuItems,
      "edit",
      t("executionFactory.cardMenu.edit"),
      onAction,
      "edit",
      item,
    );
  }

  if (activeTab === "mcp" || activeTab === "skill") {
    pushMenuAction(
      menuItems,
      "view",
      t("executionFactory.cardMenu.view"),
      onAction,
      "view",
      item,
    );
  }

  if (activeTab === "mcp") {
    pushMenuAction(
      menuItems,
      "edit",
      t("executionFactory.cardMenu.edit"),
      onAction,
      "edit",
      item,
    );
  }

  if (activeTab === "skill") {
    pushMenuAction(
      menuItems,
      "edit",
      t("executionFactory.cardMenu.edit"),
      onAction,
      "edit",
      item,
    );
    pushMenuAction(
      menuItems,
      "download",
      t("executionFactory.cardMenu.download"),
      onAction,
      "download",
      item,
    );
    pushMenuAction(
      menuItems,
      "updatePackage",
      t("executionFactory.cardMenu.updatePackage"),
      onAction,
      "updatePackage",
      item,
    );
  }

  if (activeTab === "operator" || activeTab === "toolbox" || activeTab === "mcp") {
    const exportDisabled = activeTab === "toolbox" && item.status !== "published";
    pushMenuAction(
      menuItems,
      "export",
      t("executionFactory.cardMenu.export"),
      onAction,
      "export",
      item,
      exportDisabled
        ? {
            disabled: true,
            disabledReason: t("executionFactory.exportDisabledUntilPublished"),
          }
        : undefined,
    );
  }

  for (const lifecycleAction of getExecutionUnitLifecycleActions(item.status)) {
    pushMenuAction(
      menuItems,
      lifecycleAction,
      t(
        lifecycleAction === "publish"
          ? "executionFactory.publish"
          : "executionFactory.offline",
      ),
      onAction,
      lifecycleAction,
      item,
    );
  }

  pushMenuAction(
    menuItems,
    "authorize",
    t("systemAdmin.objectGrants.authorize"),
    onAction,
    "authorize",
    item,
  );

  pushMenuAction(menuItems, "delete", t("common.delete"), onAction, "delete", item, {
    danger: true,
  });

  if (menuItems.length === 0) {
    return null;
  }

  return (
    <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
      <button
        aria-label={t("executionFactory.cardMenu.more")}
        className={styles.cardMenuButton}
        onClick={(event) => event.stopPropagation()}
        type="button"
      >
        <MoreOutlined />
      </button>
    </Dropdown>
  );
}
