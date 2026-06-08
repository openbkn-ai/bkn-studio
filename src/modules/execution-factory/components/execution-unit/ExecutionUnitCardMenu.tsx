import { DownloadOutlined, MoreOutlined, SyncOutlined } from "@ant-design/icons";
import { Dropdown, Tag } from "antd";
import type { MenuProps } from "antd";
import { useTranslation } from "react-i18next";

import { PermissionGate } from "@/framework/permission/PermissionGate";
import { AppButton } from "@/framework/ui/common/AppButton";

import type { ExecutionUnitCardItem, ExecutionUnitTab } from "./types";

import styles from "./ExecutionUnitCard.module.css";

export type ExecutionUnitCardAction =
  | "view"
  | "edit"
  | "export"
  | "download"
  | "updatePackage"
  | "publish"
  | "unpublish"
  | "offline"
  | "delete"
  | "install";

type ExecutionUnitCardMenuProps = {
  activeTab: ExecutionUnitTab;
  installedStateReady?: boolean;
  item: ExecutionUnitCardItem;
  marketMode?: boolean;
  onAction: (action: ExecutionUnitCardAction, item: ExecutionUnitCardItem) => void;
};

function getInstallPermission(_activeTab: ExecutionUnitTab) {
  return "execution-factory:catalog:install";
}

function pushMenuAction(
  menuItems: MenuProps["items"],
  key: string,
  label: string,
  onAction: ExecutionUnitCardMenuProps["onAction"],
  action: ExecutionUnitCardAction,
  item: ExecutionUnitCardItem,
  options?: { danger?: boolean },
) {
  menuItems?.push({
    key,
    danger: options?.danger,
    label,
    onClick: ({ domEvent }) => {
      domEvent.stopPropagation();
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
    const permission = getInstallPermission(activeTab);
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
    pushMenuAction(
      menuItems,
      "export",
      t("executionFactory.cardMenu.export"),
      onAction,
      "export",
      item,
    );
  }

  if (item.status === "unpublish" || item.status === "editing") {
    pushMenuAction(
      menuItems,
      "publish",
      t("executionFactory.publish"),
      onAction,
      "publish",
      item,
    );
  }

  if (item.status === "published") {
    pushMenuAction(
      menuItems,
      "unpublish",
      t("executionFactory.cardMenu.unpublish"),
      onAction,
      "unpublish",
      item,
    );
    pushMenuAction(
      menuItems,
      "offline",
      t("executionFactory.statuses.offline"),
      onAction,
      "offline",
      item,
    );
  }

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
