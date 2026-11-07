/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CheckOutlined } from "@ant-design/icons";
import { Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { type ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { DetailTableColumnSettingsButton } from "@/modules/knowledge-network/components/shared/DetailTableColumnSettingsButton";
import {
  getObjectTypePropertyTableColumnLabel,
  ObjectTypePropertyTableColumns,
} from "@/modules/knowledge-network/components/object-type/ObjectTypePropertyTableColumns";
import { useObjectTypePropertyTableState } from "@/modules/knowledge-network/components/object-type/useObjectTypePropertyTableState";
import { ValueTypeEnumItems } from "@/modules/knowledge-network/components/value-type/ValueTypeEnumItems";
import type { ObjectTypeDataProperty } from "@/modules/knowledge-network/types/object-type";
import type { ValueType } from "@/modules/knowledge-network/types/value-type";

import { PropertyDeclarationTags } from "./PropertyDeclarationTags";

import styles from "./ObjectTypePropertyTable.module.css";

export type ObjectTypePropertyTableState = ReturnType<typeof useObjectTypePropertyTableState>;

const NO_VALUE_TYPES: readonly ValueType[] = [];

type ObjectTypePropertyTableProps = {
  /**
   * Shows the BKN spec 3.0 declarations column; set when any property of the object type has
   * declarations, so an object type without them looks as it always did.
   */
  declarationsShown?: boolean;
  properties: ObjectTypeDataProperty[];
  rowIndexOffset?: number;
  showToolbar?: boolean;
  tableState?: ObjectTypePropertyTableState;
  toolbarExtra?: ReactNode;
  /** The network's value types, to name the ones properties reference and list enum items. */
  valueTypes?: readonly ValueType[];
};

type ObjectTypePropertyTableColumnSettingsProps = {
  tableState: ObjectTypePropertyTableState;
  visibleColumnKeys: string[];
};

type ObjectTypePropertyDescriptionCellProps = {
  value?: string;
};

export function ObjectTypePropertyDescriptionCell({
  value,
}: ObjectTypePropertyDescriptionCellProps) {
  const text = value?.trim() || "—";

  return (
    <Tooltip title={text}>
      <span className={styles.cellEllipsis}>{text}</span>
    </Tooltip>
  );
}

export function ObjectTypePropertyTableColumnSettings({
  tableState,
  visibleColumnKeys,
}: ObjectTypePropertyTableColumnSettingsProps) {
  const { columnVisibility, handleColumnConfigChange, storageScope, tableColumns } = tableState;

  return (
    <DetailTableColumnSettingsButton
      columnOrder={tableColumns.map((column) => column.key)}
      columns={ObjectTypePropertyTableColumns}
      onChange={handleColumnConfigChange}
      storageScope={storageScope}
      value={columnVisibility}
      visibleColumnKeys={visibleColumnKeys}
    />
  );
}

export function ObjectTypePropertyTable({
  declarationsShown = false,
  properties,
  rowIndexOffset = 0,
  showToolbar = true,
  tableState: externalTableState,
  toolbarExtra,
  valueTypes = NO_VALUE_TYPES,
}: ObjectTypePropertyTableProps) {
  const { t } = useTranslation();
  const internalTableState = useObjectTypePropertyTableState();
  const tableState = externalTableState ?? internalTableState;
  const { tableColumns, handleTableChange } = tableState;

  const columns = useMemo<ColumnsType<ObjectTypeDataProperty>>(() => {
    const shownColumns = declarationsShown
      ? tableColumns
      : tableColumns.filter((column) => column.key !== "declarations");
    const dataColumns: ColumnsType<ObjectTypeDataProperty> = shownColumns.map((column) => {
      switch (column.key) {
        case "declarations":
          return {
            key: "declarations",
            dataIndex: "declarations",
            title: t("knowledgeNetwork.propertyDeclarations.column"),
            width: 280,
            render: (value: ObjectTypeDataProperty["declarations"]) => (
              <PropertyDeclarationTags declarations={value} valueTypes={valueTypes} />
            ),
          };
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
        case "comment":
          return {
            key: "comment",
            dataIndex: "comment",
            title: t("knowledgeNetwork.objectTypePropertyDescription"),
            width: 240,
            render: (value?: string) => <ObjectTypePropertyDescriptionCell value={value} />,
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
        case "indexFeatures":
          return {
            key: "indexFeatures",
            dataIndex: "indexFeatures",
            title: t("knowledgeNetwork.objectTypePropertyIndexFeatures"),
            width: 220,
            render: (value: ObjectTypeDataProperty["indexFeatures"]) => {
              const configuredFeatures = value?.filter((feature) => feature.configured) ?? [];
              if (!configuredFeatures.length) {
                return "—";
              }

              return (
                <span className={styles.indexFeatures}>
                  {configuredFeatures.map((feature) => {
                    const availability =
                      feature.available === true
                        ? t("knowledgeNetwork.objectTypeIndexFeatureAvailable")
                        : feature.available === false
                          ? t("knowledgeNetwork.objectTypeIndexFeatureUnavailable")
                          : t("knowledgeNetwork.objectTypeIndexFeatureUnknown");
                    const color = feature.available === true ? "blue" : undefined;

                    return (
                      <Tooltip key={feature.type} title={`${feature.type}: ${availability}`}>
                        <Tag
                          className={
                            feature.available === true
                              ? styles.indexFeatureAvailable
                              : feature.available === false
                                ? styles.indexFeatureUnavailable
                                : styles.indexFeatureUnknown
                          }
                          color={color}
                        >
                          {feature.type}
                        </Tag>
                      </Tooltip>
                    );
                  })}
                </span>
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
  }, [declarationsShown, rowIndexOffset, t, tableColumns, valueTypes]);

  const enumItemsOf = (property: ObjectTypeDataProperty) => {
    const valueTypeId = property.declarations?.constraints?.valueType;
    return valueTypeId ? valueTypes.find((item) => item.id === valueTypeId)?.enum : undefined;
  };

  const visibleColumnKeys = useMemo(() => columns.map((column) => String(column.key)), [columns]);

  return (
    <div
      className={
        showToolbar ? styles.tableSection : `${styles.tableSection} ${styles.tableSectionCompact}`
      }
    >
      {showToolbar ? (
        <div className={styles.tableToolbar}>
          {toolbarExtra}
          <ObjectTypePropertyTableColumnSettings
            tableState={tableState}
            visibleColumnKeys={visibleColumnKeys}
          />
        </div>
      ) : null}
      <Table<ObjectTypeDataProperty>
        className={styles.table}
        columns={columns}
        dataSource={properties}
        expandable={
          declarationsShown
            ? {
                expandedRowRender: (property) => (
                  <ValueTypeEnumItems
                    items={enumItemsOf(property) ?? []}
                    label={t("knowledgeNetwork.propertyDeclarations.enumItems")}
                    variant="tags"
                  />
                ),
                rowExpandable: (property) => Boolean(enumItemsOf(property)?.length),
              }
            : undefined
        }
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
