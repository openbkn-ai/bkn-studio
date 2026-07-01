/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Table } from "antd";
import type { TableProps } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { getActionSourceDisplayName } from "@/modules/knowledge-network/utils/action-type-execution";
import { FieldTypeIcon } from "@/modules/knowledge-network/components/object-type/data-attribute/FieldTypeIcon";
import { getKnowledgeNetworkObjectTypeDetail } from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  ActionTypeDetail,
  ActionTypeExecutionParameter,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ActionTypeExecutionConfigTable.module.css";

type ActionTypeExecutionConfigTableProps = {
  detail: ActionTypeDetail;
  networkId: string;
};

type ParameterRow = ActionTypeExecutionParameter & { key: string };

export function ActionTypeExecutionConfigTable({
  detail,
  networkId,
}: ActionTypeExecutionConfigTableProps) {
  const { t } = useTranslation();
  const [propertyTypeMap, setPropertyTypeMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadProperties = async () => {
      if (!networkId || !detail.objectTypeId) {
        setPropertyTypeMap({});
        return;
      }

      const objectTypeDetail = await getKnowledgeNetworkObjectTypeDetail(
        networkId,
        detail.objectTypeId,
      );
      setPropertyTypeMap(
        Object.fromEntries(
          (objectTypeDetail?.dataProperties ?? []).map((item) => [item.name, item.type]),
        ),
      );
    };

    void loadProperties();
  }, [detail.objectTypeId, networkId]);

  const rows = useMemo<ParameterRow[]>(
    () =>
      detail.executionConfig.parameters
        .filter((item) => item.name.trim() && item.sourcePropertyName)
        .map((item, index) => ({
          ...item,
          key: `${item.name}-${index}`,
        })),
    [detail.executionConfig.parameters],
  );

  const columns: TableProps<ParameterRow>["columns"] = [
    {
      dataIndex: "name",
      key: "name",
      title: t("knowledgeNetwork.actionTypeExecutionParameterName"),
      width: 220,
    },
    {
      dataIndex: "sourcePropertyName",
      key: "sourcePropertyName",
      render: (value: string) => (
        <div className={styles.propertyCell}>
          <FieldTypeIcon type={propertyTypeMap[value] ?? "string"} />
          <span>{value || t("knowledgeNetwork.actionTypeEmptyValue")}</span>
        </div>
      ),
      title: t("knowledgeNetwork.actionTypeExecutionObjectProperty"),
    },
  ];

  const sourceLabel =
    getActionSourceDisplayName(detail.executionConfig.actionSource) ||
    detail.executionConfig.sourceName;

  return (
    <div className={styles.root}>
      <div className={styles.metaRow}>
        <div>
          <span>{t("knowledgeNetwork.actionTypeExecutionSourceLabel")}</span>
          <strong>{sourceLabel || t("knowledgeNetwork.actionTypeEmptyValue")}</strong>
        </div>
      </div>
      <Table<ParameterRow>
        bordered
        columns={columns}
        dataSource={rows}
        locale={{ emptyText: t("knowledgeNetwork.actionTypeExecutionParameterEmpty") }}
        pagination={false}
        rowKey="key"
        size="small"
      />
    </div>
  );
}
