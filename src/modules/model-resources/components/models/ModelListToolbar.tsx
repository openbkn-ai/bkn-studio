/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DeleteOutlined, PlusOutlined, ReloadOutlined, SortAscendingOutlined } from "@ant-design/icons";
import { Dropdown, Input, Select } from "antd";
import type { MenuProps } from "antd";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { PermissionGate } from "@/framework/permission/PermissionGate";
import { AppButton } from "@/framework/ui/common/AppButton";

import styles from "./ModelListPanels.module.css";

type ModelListToolbarProps = {
  canCreate?: boolean;
  createNode?: ReactNode;
  createPermissions?: string;
  deleteDisabled?: boolean;
  deletePermissions?: string;
  modelType: string;
  modelTypeOptions: { label: string; value: string }[];
  onCreate?: () => void;
  onDelete?: () => void;
  onModelTypeChange: (value: string) => void;
  onRefresh: () => void;
  onSearch: (value: string) => void;
  onSortChange: (key: string) => void;
  refreshing?: boolean;
  searchDefaultValue?: string;
  showCreate?: boolean;
  showDelete?: boolean;
  sortAriaLabel: string;
  sortMenuItems: MenuProps["items"];
  sortRule: string;
};

export function ModelListToolbar({
  canCreate = true,
  createNode,
  createPermissions,
  deleteDisabled = true,
  deletePermissions,
  modelType,
  modelTypeOptions,
  onCreate,
  onDelete,
  onModelTypeChange,
  onRefresh,
  onSearch,
  onSortChange,
  refreshing = false,
  searchDefaultValue = "",
  showCreate = true,
  showDelete = true,
  sortAriaLabel,
  sortMenuItems,
  sortRule,
}: ModelListToolbarProps) {
  const { t } = useTranslation();

  const createButton = createNode ?? (
    <AppButton className={styles.toolbarButton} icon={<PlusOutlined />} onClick={onCreate} type="primary">
      {t("common.create")}
    </AppButton>
  );

  const deleteButton = (
    <AppButton
      className={styles.toolbarButton}
      disabled={deleteDisabled}
      icon={<DeleteOutlined />}
      onClick={onDelete}
    >
      {t("common.delete")}
    </AppButton>
  );

  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarLeft}>
        {showCreate ? (
          createPermissions ? (
            <PermissionGate permissions={createPermissions}>{createButton}</PermissionGate>
          ) : canCreate ? (
            createButton
          ) : null
        ) : null}
        {showDelete ? (
          deletePermissions ? (
            <PermissionGate permissions={deletePermissions}>{deleteButton}</PermissionGate>
          ) : (
            deleteButton
          )
        ) : null}
      </div>

      <div className={styles.toolbarRight}>
        <Input.Search
          allowClear
          className={styles.searchInput}
          defaultValue={searchDefaultValue}
          onSearch={onSearch}
          placeholder={t("modelResources.models.searchPlaceholder")}
        />
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>{t("modelResources.models.modelType")}</span>
          <Select
            className={styles.typeFilter}
            options={modelTypeOptions}
            value={modelType}
            onChange={onModelTypeChange}
          />
        </div>
        <Dropdown
          menu={{
            items: sortMenuItems,
            selectedKeys: [sortRule],
            onClick: ({ key }) => onSortChange(String(key)),
          }}
          trigger={["click"]}
        >
          <button aria-label={sortAriaLabel} className={styles.iconButton} type="button">
            <SortAscendingOutlined />
          </button>
        </Dropdown>
        <button
          aria-label={t("common.refresh")}
          className={styles.iconButton}
          disabled={refreshing}
          onClick={onRefresh}
          type="button"
        >
          <ReloadOutlined />
        </button>
      </div>
    </div>
  );
}
