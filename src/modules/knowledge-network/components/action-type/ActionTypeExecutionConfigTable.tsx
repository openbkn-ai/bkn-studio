/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Spin, Table } from "antd";
import type { TableProps } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { getActionSourceDisplayName } from "@/modules/knowledge-network/utils/action-type-execution";
import { FieldTypeIcon } from "@/modules/knowledge-network/components/object-type/data-attribute/FieldTypeIcon";
import { getKnowledgeNetworkObjectTypeDetail } from "@/modules/knowledge-network/services/knowledge-network.service";
import {
  needsActionTypeActionSourceDisplayResolution,
  resolveActionTypeActionSourceDisplayWithTimeout,
  resolveActionTypeToolInputSchema,
} from "@/modules/knowledge-network/services/action-type-tool.service";
import type {
  ActionTypeActionSource,
  ActionTypeDetail,
  ActionTypeExecutionParameter,
} from "@/modules/knowledge-network/types/knowledge-network";
import type { ActionTypeToolInputParam } from "@/modules/knowledge-network/utils/tool-input-params";

import styles from "./ActionTypeExecutionConfigTable.module.css";

type ActionTypeExecutionConfigTableProps = {
  canResolveActionSource: boolean;
  detail: ActionTypeDetail;
  networkId: string;
};

type ParameterRow = ActionTypeExecutionParameter & { key: string };

type ParameterSchemaInfo = Pick<ActionTypeToolInputParam, "source" | "type">;

function getParameterValueFromKey(valueFrom: ActionTypeExecutionParameter["valueFrom"]) {
  switch (valueFrom) {
    case "const":
      return "knowledgeNetwork.actionTypeExecutionValueFromConst";
    case "property":
      return "knowledgeNetwork.actionTypeExecutionValueFromProperty";
    case "input":
    default:
      return "knowledgeNetwork.actionTypeExecutionValueFromInput";
  }
}

function flattenParameterSchema(
  params: ActionTypeToolInputParam[],
  result: Record<string, ParameterSchemaInfo> = {},
) {
  for (const param of params) {
    result[param.key] = {
      source: param.source,
      type: param.type,
    };

    if (param.name !== param.key) {
      result[param.name] = {
        source: param.source,
        type: param.type,
      };
    }

    if (param.children?.length) {
      flattenParameterSchema(param.children, result);
    }
  }

  return result;
}

export function ActionTypeExecutionConfigTable({
  canResolveActionSource,
  detail,
  networkId,
}: ActionTypeExecutionConfigTableProps) {
  const { t } = useTranslation();
  const [propertyTypeMap, setPropertyTypeMap] = useState<Record<string, string>>({});
  const [resolvedActionSource, setResolvedActionSource] = useState<
    ActionTypeActionSource | undefined
  >(detail.executionConfig.actionSource);
  const [parameterSchemaMap, setParameterSchemaMap] = useState<
    Record<string, ParameterSchemaInfo>
  >({});
  const [actionSourceResolutionFailed, setActionSourceResolutionFailed] = useState(false);
  const [isResolvingActionSource, setIsResolvingActionSource] = useState(false);

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

  useEffect(() => {
    const actionSource = detail.executionConfig.actionSource;
    setResolvedActionSource(actionSource);

    if (
      !canResolveActionSource ||
      !actionSource ||
      !needsActionTypeActionSourceDisplayResolution(actionSource)
    ) {
      setActionSourceResolutionFailed(false);
      setIsResolvingActionSource(false);
      return;
    }

    let cancelled = false;
    setActionSourceResolutionFailed(false);
    setIsResolvingActionSource(true);
    const resolveDisplay = async () => {
      try {
        const resolved = await resolveActionTypeActionSourceDisplayWithTimeout(actionSource);
        if (!cancelled) {
          setResolvedActionSource(resolved);
          setActionSourceResolutionFailed(
            needsActionTypeActionSourceDisplayResolution(resolved),
          );
        }
      } catch {
        if (!cancelled) {
          setActionSourceResolutionFailed(true);
        }
      } finally {
        if (!cancelled) {
          setIsResolvingActionSource(false);
        }
      }
    };

    void resolveDisplay();

    return () => {
      cancelled = true;
    };
  }, [canResolveActionSource, detail.executionConfig.actionSource]);

  useEffect(() => {
    const actionSource = detail.executionConfig.actionSource;
    if (!canResolveActionSource || !actionSource) {
      setParameterSchemaMap({});
      return;
    }

    let cancelled = false;
    const loadParameterSchema = async () => {
      try {
        const schema = await resolveActionTypeToolInputSchema(actionSource);
        if (!cancelled) {
          setParameterSchemaMap(flattenParameterSchema(schema));
        }
      } catch {
        if (!cancelled) {
          setParameterSchemaMap({});
        }
      }
    };

    void loadParameterSchema();

    return () => {
      cancelled = true;
    };
  }, [canResolveActionSource, detail.executionConfig.actionSource]);

  const rows = useMemo<ParameterRow[]>(
    () =>
      detail.executionConfig.parameters
        .filter((item) => item.name.trim())
        .map((item, index) => ({
          ...item,
          key: `${item.name}-${index}`,
          source: item.source || parameterSchemaMap[item.name]?.source,
          type: item.type || parameterSchemaMap[item.name]?.type,
        })),
    [detail.executionConfig.parameters, parameterSchemaMap],
  );

  const columns: TableProps<ParameterRow>["columns"] = [
    {
      dataIndex: "name",
      key: "name",
      title: t("knowledgeNetwork.actionTypeExecutionParameterName"),
      width: 220,
    },
    {
      dataIndex: "type",
      key: "type",
      render: (value: string | undefined) =>
        value || t("knowledgeNetwork.actionTypeEmptyValue"),
      title: t("knowledgeNetwork.actionTypeExecutionParameterType"),
      width: 120,
    },
    {
      dataIndex: "source",
      key: "source",
      render: (value: string | undefined) =>
        value || t("knowledgeNetwork.actionTypeEmptyValue"),
      title: t("knowledgeNetwork.actionTypeExecutionParameterSource"),
      width: 120,
    },
    {
      key: "valueFrom",
      render: (_value, record) =>
        t(getParameterValueFromKey(record.valueFrom ?? "input")),
      title: t("knowledgeNetwork.actionTypeExecutionParameterValueSource"),
      width: 140,
    },
    {
      key: "value",
      render: (_value, record) => {
        const valueFrom = record.valueFrom ?? "input";
        if (valueFrom === "property") {
          const propertyName = record.sourcePropertyName || record.value || "";
          return (
            <div className={styles.propertyCell}>
              <FieldTypeIcon type={propertyTypeMap[propertyName] ?? "string"} />
              <span>{propertyName || t("knowledgeNetwork.actionTypeEmptyValue")}</span>
            </div>
          );
        }

        if (valueFrom === "const") {
          return record.value?.trim() || t("knowledgeNetwork.actionTypeEmptyValue");
        }

        return t("knowledgeNetwork.actionTypeExecutionValueFromInput");
      },
      title: t("knowledgeNetwork.actionTypeExecutionParameterValue"),
    },
  ];

  const sourceUnavailable =
    actionSourceResolutionFailed &&
    needsActionTypeActionSourceDisplayResolution(resolvedActionSource);
  const sourceLabel = isResolvingActionSource || sourceUnavailable
    ? ""
    : getActionSourceDisplayName(resolvedActionSource) || detail.executionConfig.sourceName;

  return (
    <div className={styles.root}>
      <div className={styles.metaRow}>
        <div>
          <span>{t("knowledgeNetwork.actionTypeExecutionSourceLabel")}</span>
          {isResolvingActionSource ? (
            <strong className={styles.loadingSource}>
              <Spin size="small" />
              {t("knowledgeNetwork.actionTypeExecutionSourceResolving")}
            </strong>
          ) : (
            <strong className={sourceUnavailable ? styles.unavailableSource : undefined}>
              {sourceUnavailable
                ? t("knowledgeNetwork.actionTypeExecutionSourceUnavailable")
                : sourceLabel || t("knowledgeNetwork.actionTypeEmptyValue")}
            </strong>
          )}
        </div>
      </div>
      <Table<ParameterRow>
        bordered
        columns={columns}
        dataSource={rows}
        locale={{ emptyText: t("knowledgeNetwork.actionTypeExecutionParameterEmpty") }}
        pagination={false}
        rowKey="key"
        scroll={{ x: 820 }}
        size="small"
      />
    </div>
  );
}
