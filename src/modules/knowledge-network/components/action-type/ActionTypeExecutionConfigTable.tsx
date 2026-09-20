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

import { getReadableActionSourceDisplayName } from "@/modules/knowledge-network/utils/action-type-execution";
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
import { getAllExpandableParamKeys } from "@/modules/knowledge-network/utils/tool-input-params";
import {
  buildParamTableRows,
  type ActionTypeParamTableRow,
} from "@/modules/knowledge-network/utils/tool-params-table-state";

import styles from "./ActionTypeExecutionConfigTable.module.css";

type ActionTypeExecutionConfigTableProps = {
  canResolveActionSource: boolean;
  detail: ActionTypeDetail;
  networkId: string;
};

function getParameterValueFromKey(valueFrom: ActionTypeParamTableRow["valueFrom"]) {
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

function countLeafRows(rows: ActionTypeParamTableRow[]): number {
  return rows.reduce(
    (count, row) => count + (row.children?.length ? countLeafRows(row.children) : 1),
    0,
  );
}

function getSchemaParameters(schema: ActionTypeToolInputParam[]): ActionTypeToolInputParam[] {
  return schema.flatMap((parameter) => [
    parameter,
    ...getSchemaParameters(parameter.children ?? []),
  ]);
}

function buildSavedParameterRows(
  parameters: ActionTypeExecutionParameter[],
): ActionTypeParamTableRow[] {
  return parameters
    .filter((item) => item.name.trim())
    .map((item, index) => ({
      description: item.description,
      key: `${item.name}-${index}`,
      name: item.name,
      source: item.source,
      type: item.type ?? "",
      value: item.value ?? item.sourcePropertyName ?? "",
      valueFrom: item.valueFrom ?? "input",
    }));
}

function normalizeSavedParametersForSchema(
  schema: ActionTypeToolInputParam[],
  parameters: ActionTypeExecutionParameter[],
): ActionTypeExecutionParameter[] {
  const schemaParameters = getSchemaParameters(schema);
  const schemaKeys = new Set(schemaParameters.map((item) => item.key));

  return parameters.map((parameter) => {
    if (schemaKeys.has(parameter.name)) {
      return parameter;
    }

    const nameMatches = schemaParameters.filter((item) => item.name === parameter.name);
    return nameMatches.length === 1 ? { ...parameter, name: nameMatches[0].key } : parameter;
  });
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
  const [parameterSchema, setParameterSchema] = useState<ActionTypeToolInputParam[]>([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [actionSourceResolutionFailed, setActionSourceResolutionFailed] = useState(false);
  const [isResolvingActionSource, setIsResolvingActionSource] = useState(false);
  const [isLoadingParameterSchema, setIsLoadingParameterSchema] = useState(false);

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

    if (!actionSource || !needsActionTypeActionSourceDisplayResolution(actionSource)) {
      setActionSourceResolutionFailed(false);
      setIsResolvingActionSource(false);
      return;
    }

    if (!canResolveActionSource) {
      setActionSourceResolutionFailed(true);
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
          setActionSourceResolutionFailed(needsActionTypeActionSourceDisplayResolution(resolved));
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
      setParameterSchema([]);
      setIsLoadingParameterSchema(false);
      return;
    }

    let cancelled = false;
    const loadParameterSchema = async () => {
      setIsLoadingParameterSchema(true);
      try {
        const schema = await resolveActionTypeToolInputSchema(actionSource);
        if (!cancelled) {
          setParameterSchema(schema);
        }
      } catch {
        if (!cancelled) {
          setParameterSchema([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingParameterSchema(false);
        }
      }
    };

    void loadParameterSchema();

    return () => {
      cancelled = true;
    };
  }, [canResolveActionSource, detail.executionConfig.actionSource]);

  useEffect(() => {
    setExpandedRowKeys(getAllExpandableParamKeys(parameterSchema));
  }, [parameterSchema]);

  // The tool's input schema is the full parameter list; the saved parameters only
  // carry the bindings the author changed, and an action type imported from a spec
  // often has none at all. Render the schema and overlay the saved bindings so the
  // detail view lists the same parameters the editor does (issue: detail showed an
  // empty table while the editor showed every tool parameter).
  const rows = useMemo<ActionTypeParamTableRow[]>(() => {
    const savedParameters = detail.executionConfig.parameters;

    if (parameterSchema.length > 0) {
      const normalizedSavedParameters = normalizeSavedParametersForSchema(
        parameterSchema,
        savedParameters,
      );
      const schemaKeys = new Set(getSchemaParameters(parameterSchema).map((item) => item.key));

      return [
        ...buildParamTableRows(parameterSchema, normalizedSavedParameters),
        ...buildSavedParameterRows(
          normalizedSavedParameters.filter((item) => !schemaKeys.has(item.name)),
        ),
      ];
    }

    return buildSavedParameterRows(savedParameters);
  }, [detail.executionConfig.parameters, parameterSchema]);

  const columns: TableProps<ActionTypeParamTableRow>["columns"] = [
    {
      dataIndex: "name",
      key: "name",
      title: t("knowledgeNetwork.actionTypeExecutionParameterName"),
      width: 220,
    },
    {
      dataIndex: "type",
      key: "type",
      render: (value: string | undefined) => value || t("knowledgeNetwork.actionTypeEmptyValue"),
      title: t("knowledgeNetwork.actionTypeExecutionParameterType"),
      width: 120,
    },
    {
      dataIndex: "source",
      key: "source",
      render: (value: string | undefined, record) =>
        record.children?.length ? "" : value || t("knowledgeNetwork.actionTypeEmptyValue"),
      title: t("knowledgeNetwork.actionTypeExecutionParameterSource"),
      width: 120,
    },
    {
      key: "valueFrom",
      render: (_value, record) =>
        record.children?.length ? "" : t(getParameterValueFromKey(record.valueFrom ?? "input")),
      title: t("knowledgeNetwork.actionTypeExecutionParameterValueSource"),
      width: 140,
    },
    {
      key: "value",
      render: (_value, record) => {
        if (record.children?.length) {
          return "";
        }

        const valueFrom = record.valueFrom ?? "input";
        if (valueFrom === "property") {
          const propertyName = record.value || "";
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
  const sourceLabel =
    isResolvingActionSource || sourceUnavailable
      ? ""
      : getReadableActionSourceDisplayName(resolvedActionSource);

  return (
    <div className={styles.root}>
      <div className={styles.metaRow}>
        <div>
          <span>{t("knowledgeNetwork.actionTypeOperatorLabel")}</span>
          {isResolvingActionSource ? (
            <strong className={styles.loadingSource}>
              <Spin size="small" />
              {t("knowledgeNetwork.actionTypeExecutionSourceResolving")}
            </strong>
          ) : (
            <strong className={sourceUnavailable ? styles.unavailableSource : undefined}>
              {sourceUnavailable
                ? t("knowledgeNetwork.actionTypeEmptyValue")
                : sourceLabel || t("knowledgeNetwork.actionTypeEmptyValue")}
            </strong>
          )}
        </div>
        <div>
          <span>{t("knowledgeNetwork.actionTypeExecutionParameters")}</span>
          <strong>{countLeafRows(rows)}</strong>
        </div>
      </div>
      <Table<ActionTypeParamTableRow>
        bordered
        columns={columns}
        dataSource={rows}
        expandable={{
          expandRowByClick: true,
          expandedRowKeys,
          indentSize: 20,
          onExpandedRowsChange: (keys) => setExpandedRowKeys(keys as string[]),
        }}
        loading={isLoadingParameterSchema}
        locale={{ emptyText: t("knowledgeNetwork.actionTypeExecutionParameterEmpty") }}
        pagination={false}
        rowKey="key"
        scroll={{ x: 820 }}
        size="small"
      />
    </div>
  );
}
