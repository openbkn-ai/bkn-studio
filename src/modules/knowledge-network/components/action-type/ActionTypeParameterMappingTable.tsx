/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DatabaseOutlined } from "@ant-design/icons";
import { Select, Table } from "antd";
import type { TableProps } from "antd";
import { useTranslation } from "react-i18next";

import { FieldTypeIcon } from "@/modules/knowledge-network/components/object-type/data-attribute/FieldTypeIcon";
import { RelationTypePropertySelect } from "@/modules/knowledge-network/components/relation-type/RelationTypePropertySelect";
import type { RelationTypePropertyOption } from "@/modules/knowledge-network/components/relation-type/RelationTypePropertySelect";
import type { ActionTypeExecutionParameter } from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ActionTypeParameterMappingTable.module.css";

type ActionTypeParameterMappingTableProps = {
  hasSource: boolean;
  objectTypeId?: string;
  parameterTypeByName: Record<string, string>;
  parameters: ActionTypeExecutionParameter[];
  propertyOptions: RelationTypePropertyOption[];
  onChange: (parameters: ActionTypeExecutionParameter[]) => void;
};

export function ActionTypeParameterMappingTable({
  hasSource,
  objectTypeId,
  parameterTypeByName,
  parameters,
  propertyOptions,
  onChange,
}: ActionTypeParameterMappingTableProps) {
  const { t } = useTranslation();

  const updateParameter = (index: number, patch: Partial<ActionTypeExecutionParameter>) => {
    onChange(
      parameters.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch, valueFrom: "property" as const } : item,
      ),
    );
  };

  const columns: TableProps<ActionTypeExecutionParameter>["columns"] = [
    {
      dataIndex: "name",
      key: "name",
      title: t("knowledgeNetwork.actionTypeExecutionParameterName"),
      width: 220,
      render: (cellValue: string) => (
        <span className={styles.readOnlyName}>{cellValue || t("knowledgeNetwork.actionTypeEmptyValue")}</span>
      ),
    },
    {
      key: "type",
      title: t("knowledgeNetwork.actionTypeExecutionParameterType"),
      width: 160,
      render: (_value, record) => {
        const parameterType = parameterTypeByName[record.name] ?? "string";
        return (
          <span className={styles.typeCell}>
            <FieldTypeIcon type={parameterType} />
            <span>{parameterType}</span>
          </span>
        );
      },
    },
    {
      key: "source",
      title: t("knowledgeNetwork.actionTypeExecutionParameterSource"),
      width: 140,
      render: () => (
        <Select
          className={styles.sourceCell}
          disabled
          options={[
            {
              label: t("knowledgeNetwork.actionTypeExecutionParameterSourceProperty"),
              value: "property",
            },
          ]}
          value="property"
        />
      ),
    },
    {
      dataIndex: "sourcePropertyName",
      key: "value",
      title: t("knowledgeNetwork.actionTypeExecutionParameterValue"),
      render: (cellValue: string, _record, index) => (
        <RelationTypePropertySelect
          allowClear
          disabled={!objectTypeId || !hasSource}
          fields={propertyOptions}
          onChange={(nextValue) =>
            updateParameter(index, { sourcePropertyName: nextValue ?? "" })
          }
          placeholder={t("knowledgeNetwork.actionTypeExecutionObjectPropertyPlaceholder")}
          value={cellValue || undefined}
        />
      ),
    },
  ];

  const emptyContent = !hasSource ? (
    <div className={styles.tableEmpty}>
      <span aria-hidden className={styles.tableEmptyIcon}>
        <DatabaseOutlined />
      </span>
      <p className={styles.tableEmptyText}>
        {t("knowledgeNetwork.actionTypeExecutionSelectToolFirst")}
      </p>
    </div>
  ) : (
    <div className={styles.tableEmpty}>
      <p className={styles.tableEmptyText}>{t("knowledgeNetwork.actionTypeExecutionParameterEmpty")}</p>
    </div>
  );

  return (
    <div className={styles.root}>
      <Table<ActionTypeExecutionParameter>
        bordered
        className={styles.table}
        columns={columns}
        dataSource={hasSource ? parameters : []}
        locale={{ emptyText: emptyContent }}
        pagination={false}
        rowKey={(record, index) => `${record.name}-${index ?? 0}`}
        scroll={{ x: 860 }}
        size="middle"
      />
    </div>
  );
}
