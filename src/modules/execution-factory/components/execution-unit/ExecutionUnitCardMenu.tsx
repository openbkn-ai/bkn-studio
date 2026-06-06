import { DownloadOutlined, MoreOutlined } from "@ant-design/icons";
import { Dropdown } from "antd";
import type { MenuProps } from "antd";
import { useTranslation } from "react-i18next";

import { PermissionGate } from "@/framework/permission/PermissionGate";
import { AppButton } from "@/framework/ui/common/AppButton";

import type { ExecutionUnitCardItem, ExecutionUnitTab } from "./types";

import styles from "./ExecutionUnitCard.module.css";

export type ExecutionUnitCardAction =
  | "view"
  | "edit"
  | "publish"
  | "unpublish"
  | "offline"
  | "delete"
  | "install";

type ExecutionUnitCardMenuProps = {
  activeTab: ExecutionUnitTab;
  item: ExecutionUnitCardItem;
  marketMode?: boolean;
  onAction: (action: ExecutionUnitCardAction, item: ExecutionUnitCardItem) => void;
};

function getInstallPermission(activeTab: ExecutionUnitTab) {
  if (activeTab === "skill") {
    return undefined;
  }

  return "execution-factory:catalog:install";
}

export function ExecutionUnitCardMenu({
  activeTab,
  item,
  marketMode = false,
  onAction,
}: ExecutionUnitCardMenuProps) {
  const { t } = useTranslation();

  if (marketMode) {
    if (activeTab === "skill") {
      return null;
    }

    const permission = getInstallPermission(activeTab);
    if (!permission) {
      return null;
    }

    return (
      <PermissionGate permissions={permission}>
        <AppButton
          className={styles.cardInstallButton}
          icon={<DownloadOutlined />}
          onClick={(event) => {
            event.stopPropagation();
            onAction("install", item);
          }}
          size="small"
          type="primary"
        >
          {t("executionFactory.install")}
        </AppButton>
      </PermissionGate>
    );
  }

  const menuItems: MenuProps["items"] = [];

  if (activeTab === "operator") {
    menuItems.push({
      key: "edit",
      label: t("executionFactory.cardMenu.edit"),
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation();
        onAction("edit", item);
      },
    });
  }

  if (activeTab === "toolbox") {
    menuItems.push({
      key: "edit",
      label: t("executionFactory.cardMenu.edit"),
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation();
        onAction("edit", item);
      },
    });
  }

  if (activeTab === "mcp" || activeTab === "skill") {
    menuItems.push({
      key: "view",
      label: t("executionFactory.cardMenu.view"),
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation();
        onAction("view", item);
      },
    });
  }

  if (activeTab === "skill") {
    menuItems.push({
      key: "edit",
      label: t("executionFactory.cardMenu.edit"),
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation();
        onAction("edit", item);
      },
    });
  }

  if (item.status === "unpublish" || item.status === "editing") {
    menuItems.push({
      key: "publish",
      label: t("executionFactory.publish"),
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation();
        onAction("publish", item);
      },
    });
  }

  if (item.status === "published") {
    menuItems.push({
      key: "unpublish",
      label: t("executionFactory.cardMenu.unpublish"),
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation();
        onAction("unpublish", item);
      },
    });
    menuItems.push({
      key: "offline",
      label: t("executionFactory.statuses.offline"),
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation();
        onAction("offline", item);
      },
    });
  }

  menuItems.push({
    key: "delete",
    danger: true,
    label: t("common.delete"),
    onClick: ({ domEvent }) => {
      domEvent.stopPropagation();
      onAction("delete", item);
    },
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
