/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Empty, Spin, Table } from "antd";
import type { TableProps } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { formatLogicPropertyTrialValue } from "@/modules/knowledge-network/lib/format-logic-property-trial-value";
import { resolveObjectTypeDisplayKeyLabel } from "@/modules/knowledge-network/lib/object-type-display-key-label";
import {
  buildInstanceIdentityFromSampleRow,
  buildSampleRowKey,
  formatSampleRowLabel,
} from "@/modules/knowledge-network/lib/object-type-instance-identity";
import { getObjectTypeLogicPropertyValues } from "@/modules/knowledge-network/services/object-type-logic-property-trial.service";
import type {
  ObjectTypeDataProperty,
  ObjectTypeLogicProperty,
  ObjectTypeResourcePreview,
} from "@/modules/knowledge-network/types/knowledge-network";

function readLogicPropertyTrialCellValue(
  row: Awaited<ReturnType<typeof getObjectTypeLogicPropertyValues>>[number] | undefined,
  propertyName: string,
): unknown {
  return row?.values[propertyName];
}

import styles from "./ObjectTypeDetailTrialPanel.module.css";

type SampleRowEntry = {
  displayName: string;
  identity: Record<string, string | number> | null;
  key: string;
  primaryKeyLabel: string;
  row: Record<string, string | number>;
};

type ObjectTypeDetailLogicPropertyTrialPanelProps = {
  dataProperties: ObjectTypeDataProperty[];
  displayKey: string;
  highlightedLogicPropertyName?: string | null;
  initialSelectedRowKeys?: string[];
  /** Agent-retrieval `kn_id`（知识网络 identifier）；缺省回退 networkId。 */
  knId?: string;
  logicProperties: ObjectTypeLogicProperty[];
  networkId: string;
  objectTypeId: string;
  onSelectedRowKeysChange?: (rowKeys: string[]) => void;
  preview: ObjectTypeResourcePreview | null;
  previewLoading?: boolean;
  primaryKeys: string[];
};

type TrialTableRow = SampleRowEntry;

export function ObjectTypeDetailLogicPropertyTrialPanel({
  dataProperties,
  displayKey,
  highlightedLogicPropertyName = null,
  initialSelectedRowKeys = [],
  knId,
  logicProperties,
  networkId,
  objectTypeId,
  onSelectedRowKeysChange,
  preview,
  previewLoading = false,
  primaryKeys,
}: ObjectTypeDetailLogicPropertyTrialPanelProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>(initialSelectedRowKeys);
  const [valuesByRow, setValuesByRow] = useState<Record<string, Record<string, string>>>({});
  const [runningRowKeys, setRunningRowKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const displayKeyLabel = useMemo(
    () => resolveObjectTypeDisplayKeyLabel(displayKey, dataProperties, preview?.columns),
    [dataProperties, displayKey, preview?.columns],
  );

  const sampleRows = useMemo<SampleRowEntry[]>(() => {
    return (preview?.rows ?? []).map((row, index) => {
      const key = buildSampleRowKey(row, primaryKeys, index);
      return {
        displayName: formatSampleRowLabel(row, primaryKeys, displayKey),
        identity: buildInstanceIdentityFromSampleRow(row, primaryKeys),
        key,
        primaryKeyLabel:
          primaryKeys.length > 0
            ? primaryKeys.map((pk) => String(row[pk] ?? "")).join(" / ")
            : "--",
        row,
      };
    });
  }, [displayKey, preview?.rows, primaryKeys]);

  const propertyNames = useMemo(
    () => logicProperties.map((property) => property.name),
    [logicProperties],
  );

  useEffect(() => {
    if (initialSelectedRowKeys.length === 0) {
      return;
    }

    setSelectedRowKeys(initialSelectedRowKeys);
  }, [initialSelectedRowKeys]);

  const updateSelectedRowKeys = (nextKeys: string[]) => {
    setSelectedRowKeys(nextKeys);
    onSelectedRowKeysChange?.(nextKeys);
  };

  const runTrialForRows = useCallback(
    async (rowKeys: string[]) => {
      const entries = sampleRows.filter((item) => rowKeys.includes(item.key) && item.identity);

      if (entries.length === 0) {
        void message.warning(t("knowledgeNetwork.objectTypeDetailLogicTrialMissingPrimaryKey"));
        return;
      }

      const targetKeys = entries.map((item) => item.key);
      setRunningRowKeys((current) => new Set([...current, ...targetKeys]));
      setError(null);

      try {
        const result = await getObjectTypeLogicPropertyValues({
          instanceIdentities: entries.map((item) => item.identity!),
          knId,
          logicProperties,
          networkId,
          objectTypeId,
        });

        setValuesByRow((current) => {
          const next = { ...current };

          entries.forEach((entry, index) => {
            const apiRow = result[index];
            const rowValues: Record<string, string> = { ...(next[entry.key] ?? {}) };

            propertyNames.forEach((name) => {
              rowValues[name] = formatLogicPropertyTrialValue(
                readLogicPropertyTrialCellValue(apiRow, name),
              );
            });

            next[entry.key] = rowValues;
          });

          return next;
        });
      } catch (nextError) {
        setError(extractRequestErrorMessage(nextError));
      } finally {
        setRunningRowKeys((current) => {
          const next = new Set(current);
          targetKeys.forEach((key) => next.delete(key));
          return next;
        });
      }
    },
    [knId, logicProperties, message, networkId, objectTypeId, propertyNames, sampleRows, t],
  );

  const columns: TableProps<TrialTableRow>["columns"] = useMemo(() => {
    const logicColumns: NonNullable<TableProps<TrialTableRow>["columns"]> = logicProperties.map(
      (property) => ({
        className:
          highlightedLogicPropertyName === property.name ? styles.highlightColumn : undefined,
        dataIndex: property.name,
        ellipsis: true,
        key: property.name,
        render: (_value: unknown, record: TrialTableRow) => {
          if (runningRowKeys.has(record.key)) {
            return <Spin size="small" />;
          }

          return valuesByRow[record.key]?.[property.name] ?? "--";
        },
        title: property.displayName || property.name,
        width: 160,
      }),
    );

    return [
      {
        dataIndex: "primaryKeyLabel",
        ellipsis: true,
        fixed: "left",
        key: "primaryKey",
        title: t("knowledgeNetwork.objectTypePrimaryKey"),
        width: 180,
      },
      {
        dataIndex: "displayName",
        ellipsis: true,
        fixed: "left",
        key: "displayName",
        title: displayKeyLabel,
        width: 180,
      },
      ...logicColumns,
      {
        fixed: "right",
        key: "actions",
        render: (_value, record) => (
          <AppButton
            loading={runningRowKeys.has(record.key)}
            onClick={() => void runTrialForRows([record.key])}
            size="small"
            type="link"
          >
            {t("knowledgeNetwork.objectTypeDetailLogicTrialRunSingle")}
          </AppButton>
        ),
        title: t("common.actions"),
        width: 100,
      },
    ];
  }, [
    displayKeyLabel,
    highlightedLogicPropertyName,
    logicProperties,
    runTrialForRows,
    runningRowKeys,
    t,
    valuesByRow,
  ]);

  const batchRunning = selectedRowKeys.some((key) => runningRowKeys.has(key));
  const allRowsRunning =
    sampleRows.length > 0 && sampleRows.every((row) => runningRowKeys.has(row.key));
  const tableScrollX = 360 + logicProperties.length * 160 + 100;

  if (previewLoading) {
    return (
      <div className={styles.loadingState}>
        <Spin />
      </div>
    );
  }

  if (logicProperties.length === 0) {
    return <Empty description={t("knowledgeNetwork.objectTypeLogicPropertyEmpty")} />;
  }

  if (!preview || sampleRows.length === 0) {
    return <Empty description={t("knowledgeNetwork.objectTypeDetailLogicTrialNeedSample")} />;
  }

  if (primaryKeys.length === 0) {
    return (
      <Alert
        message={t("knowledgeNetwork.objectTypeDetailLogicTrialMissingPrimaryKey")}
        showIcon
        type="warning"
      />
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <AppButton
          disabled={selectedRowKeys.length === 0}
          loading={batchRunning}
          onClick={() => void runTrialForRows(selectedRowKeys)}
          type="primary"
        >
          {t("knowledgeNetwork.objectTypeDetailLogicTrialRunBatch", {
            count: selectedRowKeys.length,
          })}
        </AppButton>
        <AppButton
          loading={allRowsRunning}
          onClick={() => void runTrialForRows(sampleRows.map((row) => row.key))}
        >
          {t("knowledgeNetwork.objectTypeDetailLogicTrialRunAll")}
        </AppButton>
      </div>

      {error ? <Alert message={error} showIcon type="error" /> : null}

      <Table<TrialTableRow>
        columns={columns}
        dataSource={sampleRows}
        pagination={false}
        rowKey="key"
        rowSelection={{
          onChange: (keys) => {
            updateSelectedRowKeys(keys.map(String));
          },
          selectedRowKeys,
        }}
        scroll={{ x: tableScrollX }}
        size="small"
      />
    </div>
  );
}
