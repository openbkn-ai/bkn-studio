/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CheckOutlined } from "@ant-design/icons";
import { Table, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { type ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { DetailTableColumnSettingsButton } from "@/modules/knowledge-network/components/shared/DetailTableColumnSettingsButton";
import {
  getObjectTypePropertyTableColumnLabel,
  ObjectTypePropertyTableColumns,
} from "@/modules/knowledge-network/components/object-type/ObjectTypePropertyTableColumns";
import { useObjectTypePropertyTableState } from "@/modules/knowledge-network/components/object-type/useObjectTypePropertyTableState";
import type { ObjectTypeDataProperty } from "@/modules/knowledge-network/types/object-type";

import styles from "./ObjectTypePropertyTable.module.css";

type ObjectTypePropertyTableProps = {
  properties: ObjectTypeDataProperty[];
  rowIndexOffset?: number;
  toolbarExtra?: ReactNode;
};

export function ObjectTypePropertyTable({
  properties,
  rowIndexOffset = 0,
  toolbarExtra,
}: ObjectTypePropertyTableProps) {
  const { t } = useTranslation();
  const {
    storageScope,
    tableColumns,
    columnVisibility,
    handleTableChange,
    handleColumnConfigChange,
  } = useObjectTypePropertyTableState();

  const columns = useMemo<ColumnsType<ObjectTypeDataProperty>>(() => {
    const dataColumns: ColumnsType<ObjectTypeDataProperty> = tableColumns.map((column) => {
      switch (column.key) {
        case "name":
          return {
            key: "name",
            dataIndex: "name",
            title: t("knowledgeNetwork.objectTypePropertyName"),
            width: 160,
            render: (value: string) => (
              <Tooltip title={value}>
                <span className={styles.cellEllipsis}>{value}</span>
              </Tooltip>
            ),
          };
        case "displayName":
          return {
            key: "displayName",
            dataIndex: "displayName",
            title: t("knowledgeNetwork.objectTypePropertyDisplayName"),
            width: 160,
            render: (value: string) => {
              const text = value?.trim() || "—";
              return (
                <Tooltip title={text}>
                  <span className={styles.cellEllipsis}>{text}</span>
                </Tooltip>
              );
            },
          };
        case "type":
          return {
            key: "type",
            dataIndex: "type",
            title: t("knowledgeNetwork.objectTypePropertyType"),
            width: 120,
            render: (value: string) => (
              <Tooltip title={value}>
                <span className={styles.cellEllipsis}>{value}</span>
              </Tooltip>
            ),
          };
        case "mappedField":
          return {
            key: "mappedField",
            dataIndex: "mappedField",
            title: t("knowledgeNetwork.objectTypePropertyMappedField"),
            width: 160,
            render: (value: ObjectTypeDataProperty["mappedField"]) => {
              const text = value?.name?.trim() || "—";
              return (
                <Tooltip title={text}>
                  <span className={styles.cellEllipsis}>{text}</span>
                </Tooltip>
              );
            },
          };
        case "primaryKey":
          return {
            key: "primaryKey",
            dataIndex: "primaryKey",
            title: t("knowledgeNetwork.objectTypePropertyPrimaryKey"),
            width: 88,
            align: "center",
            render: (value: boolean) =>
              value ? <CheckOutlined className={styles.primaryKeyIcon} /> : "—",
          };
        case "displayKey":
          return {
            key: "displayKey",
            dataIndex: "displayKey",
            title: t("knowledgeNetwork.objectTypePropertyTitle"),
            width: 88,
            align: "center",
            render: (value: boolean) =>
              value ? <CheckOutlined className={styles.titleIcon} /> : "—",
          };
        case "total_count":
          return {
            key: "total_count",
            dataIndex: "totalCount",
            title: t("knowledgeNetwork.objectTypePropertyTotalCount"),
            width: 120,
            align: "right",
            render: (value: number | undefined) => {
              if (value === undefined || value === null) {
                return "—";
              }
              return value.toLocaleString();
            },
          };
        default:
          return {
            key: column.key,
            dataIndex: column.key,
            title: getObjectTypePropertyTableColumnLabel(column.key, t),
          };
      }
    });

    return [
      {
        key: "index",
        title: t("knowledgeNetwork.objectTypePropertyIndex"),
        width: 72,
        align: "center",
        render: (_value, _record, index) => rowIndexOffset + index + 1,
      },
      ...dataColumns,
    ];
  }, [rowIndexOffset, t, tableColumns]);

  const visibleColumnKeys = useMemo(
    () => columns.map((column) => String(column.key)),
    [columns],
  );

  const tableColumnKeys = useMemo(
    () => tableColumns.map((column) => column.key),
    [tableColumns],
  );

  return (
    <div className={styles.tableSection}>
      <div className={styles.tableToolbar}>
        {toolbarExtra}
        <DetailTableColumnSettingsButton
          columnOrder={tableColumnKeys}
          columns={ObjectTypePropertyTableColumns}
          onChange={handleColumnConfigChange}
          storageScope={storageScope}
          value={columnVisibility}
          visibleColumnKeys={visibleColumnKeys}
        />
      </div>
      <Table<ObjectTypeDataProperty>
        className={styles.table}
        columns={columns}
        dataSource={properties}
        onChange={handleTableChange}
        pagination={false}
        rowKey="name"
        scroll={{ x: "max-content" }}
        size="middle"
        tableLayout="fixed"
      />
    </div>
  );
}
