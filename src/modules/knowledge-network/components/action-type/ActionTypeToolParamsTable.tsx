/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DatabaseOutlined } from "@ant-design/icons";
import { Input, Select, Space, Spin, Table } from "antd";
import type { TableProps } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { RelationTypePropertySelect } from "@/modules/knowledge-network/components/relation-type/RelationTypePropertySelect";
import type { RelationTypePropertyOption } from "@/modules/knowledge-network/components/relation-type/RelationTypePropertySelect";
import type { ActionTypeExecutionParameter } from "@/modules/knowledge-network/types/knowledge-network";
import type { ActionTypeToolInputParam } from "@/modules/knowledge-network/utils/tool-input-params";
import { getAllExpandableParamKeys } from "@/modules/knowledge-network/utils/tool-input-params";
import {
  buildParamTableRows,
  extractLeafExecutionParameters,
  updateParamTableRow,
  type ActionTypeParamTableRow,
} from "@/modules/knowledge-network/utils/tool-params-table-state";

import styles from "./ActionTypeToolParamsTable.module.css";

type ActionTypeToolParamsTableProps = {
  hasSource: boolean;
  inputSchema: ActionTypeToolInputParam[];
  loading?: boolean;
  objectTypeId?: string;
  parameters: ActionTypeExecutionParameter[];
  propertyOptions: RelationTypePropertyOption[];
  onChange: (parameters: ActionTypeExecutionParameter[]) => void;
};

export function ActionTypeToolParamsTable({
  hasSource,
  inputSchema,
  loading = false,
  objectTypeId,
  parameters,
  propertyOptions,
  onChange,
}: ActionTypeToolParamsTableProps) {
  const { t } = useTranslation();
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [tableRows, setTableRows] = useState<ActionTypeParamTableRow[]>([]);

  useEffect(() => {
    setTableRows(buildParamTableRows(inputSchema, parameters));
  }, [inputSchema, parameters]);

  useEffect(() => {
    setExpandedRowKeys(getAllExpandableParamKeys(inputSchema));
  }, [inputSchema]);

  const valueFromOptions = useMemo(
    () => [
      {
        label: t("knowledgeNetwork.actionTypeExecutionValueFromConst"),
        value: "const" as const,
      },
      {
        label: t("knowledgeNetwork.actionTypeExecutionValueFromProperty"),
        value: "property" as const,
      },
      {
        label: t("knowledgeNetwork.actionTypeExecutionValueFromInput"),
        value: "input" as const,
      },
    ],
    [t],
  );

  const updateRow = (key: string, patch: Partial<ActionTypeParamTableRow>) => {
    const nextRows = updateParamTableRow(tableRows, key, patch);
    setTableRows(nextRows);
    onChange(extractLeafExecutionParameters(nextRows));
  };

  const columns: TableProps<ActionTypeParamTableRow>["columns"] = [
    {
      align: "left",
      className: styles.nameColumn,
      dataIndex: "name",
      key: "name",
      title: t("knowledgeNetwork.actionTypeExecutionParameterName"),
      width: 260,
      render: (cellValue: string, record) => (
        <div className={styles.paramName}>
          <div className={styles.paramTitle} title={cellValue}>
            {cellValue}
          </div>
          {record.description ? (
            <div className={styles.paramDescription} title={record.description}>
              {record.description}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      dataIndex: "type",
      key: "type",
      title: t("knowledgeNetwork.actionTypeExecutionParameterType"),
      width: 120,
    },
    {
      dataIndex: "source",
      key: "source",
      title: t("knowledgeNetwork.actionTypeExecutionParameterSource"),
      width: 100,
      render: (cellValue: string | undefined, record) =>
        record.children?.length ? "" : cellValue || "--",
    },
    {
      key: "value",
      title: t("knowledgeNetwork.actionTypeExecutionParameterValue"),
      render: (_value, record) => {
        if (record.children?.length) {
          return <div style={{ minHeight: 32 }} />;
        }

        const valueFrom = record.valueFrom ?? "input";

        return (
          <Space.Compact className={styles.valueFrom}>
            <Select
              className={styles.valueFromSelect}
              disabled={!hasSource}
              onChange={(nextValueFrom) =>
                updateRow(record.key, {
                  value: "",
                  valueFrom: nextValueFrom,
                })
              }
              options={valueFromOptions}
              value={valueFrom}
            />
            {valueFrom === "const" ? (
              <Input
                className={styles.valueInput}
                disabled={!hasSource}
                onChange={(event) => updateRow(record.key, { value: event.target.value })}
                placeholder={t("knowledgeNetwork.actionTypeExecutionValueConstPlaceholder")}
                value={record.value}
              />
            ) : valueFrom === "property" ? (
              <RelationTypePropertySelect
                allowClear
                className={styles.valueInput}
                disabled={!objectTypeId || !hasSource}
                fields={propertyOptions}
                onChange={(nextValue) => updateRow(record.key, { value: nextValue ?? "" })}
                placeholder={t("knowledgeNetwork.actionTypeExecutionObjectPropertyPlaceholder")}
                value={record.value || undefined}
              />
            ) : (
              <Input className={styles.valueInput} disabled placeholder="" value="" />
            )}
          </Space.Compact>
        );
      },
    },
  ];

  const emptyContent = !hasSource ? (
    <div className={styles.tableEmpty}>
      <DatabaseOutlined style={{ fontSize: 28, marginBottom: 12 }} />
      <p>{t("knowledgeNetwork.actionTypeExecutionSelectToolFirst")}</p>
    </div>
  ) : (
    <div className={styles.tableEmpty}>
      <p>{t("knowledgeNetwork.actionTypeExecutionParameterEmpty")}</p>
    </div>
  );

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <Spin />
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <Table<ActionTypeParamTableRow>
        className={styles.table}
        columns={columns}
        dataSource={hasSource ? tableRows : []}
        expandable={{
          expandRowByClick: true,
          expandedRowKeys,
          indentSize: 20,
          onExpandedRowsChange: (keys) => setExpandedRowKeys(keys as string[]),
        }}
        locale={{ emptyText: emptyContent }}
        pagination={false}
        rowKey="key"
        scroll={{ x: 920 }}
        size="middle"
      />
    </div>
  );
}
