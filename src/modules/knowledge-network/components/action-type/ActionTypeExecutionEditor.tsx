/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { getKnowledgeNetworkObjectTypeDetail } from "@/modules/knowledge-network/services/knowledge-network.service";
import { resolveActionTypeToolInputSchema } from "@/modules/knowledge-network/services/action-type-tool.service";
import type {
  ActionTypeExecutionConfig,
  ActionTypeExecutionParameter,
} from "@/modules/knowledge-network/types/knowledge-network";
import type { ActionTypeToolInputParam } from "@/modules/knowledge-network/utils/tool-input-params";
import { mergeExecutionParametersWithSchema } from "@/modules/knowledge-network/utils/tool-params-table-state";

import { ActionTypeSourcePicker } from "./ActionTypeSourcePicker";
import { ActionTypeToolParamsTable } from "./ActionTypeToolParamsTable";
import { getActionSourceDisplayName } from "@/modules/knowledge-network/utils/action-type-execution";

import styles from "./ActionTypeExecutionEditor.module.css";

export {
  cloneActionTypeExecutionConfig,
  createDefaultActionTypeExecutionConfig,
  normalizeActionTypeExecutionConfig,
  validateActionTypeExecutionConfig,
} from "@/modules/knowledge-network/utils/action-type-execution";

type ActionTypeExecutionEditorProps = {
  networkId: string;
  objectTypeId: string;
  value: ActionTypeExecutionConfig;
  onChange: (value: ActionTypeExecutionConfig) => void;
};

function buildActionSourceKey(actionSource?: ActionTypeExecutionConfig["actionSource"]) {
  if (!actionSource) {
    return "";
  }

  if (actionSource.type === "mcp") {
    return actionSource.mcpId && actionSource.toolName
      ? `mcp:${actionSource.mcpId}:${actionSource.toolName}`
      : "";
  }

  return actionSource.boxId && actionSource.toolId
    ? `tool:${actionSource.boxId}:${actionSource.toolId}`
    : "";
}

export function ActionTypeExecutionEditor({
  networkId,
  objectTypeId,
  value,
  onChange,
}: ActionTypeExecutionEditorProps) {
  const { t } = useTranslation();
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const loadedSourceKeyRef = useRef("");
  const [inputSchema, setInputSchema] = useState<ActionTypeToolInputParam[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [propertyOptions, setPropertyOptions] = useState<
    Array<{
      comment?: string;
      displayName: string;
      label: string;
      name: string;
      type: string;
      value: string;
    }>
  >([]);

  valueRef.current = value;
  onChangeRef.current = onChange;

  const sourceKey = useMemo(
    () => buildActionSourceKey(value.actionSource),
    [value.actionSource],
  );

  useEffect(() => {
    const loadProperties = async () => {
      if (!networkId || !objectTypeId) {
        setPropertyOptions([]);
        return;
      }

      const detail = await getKnowledgeNetworkObjectTypeDetail(networkId, objectTypeId);
      setPropertyOptions(
        detail?.dataProperties.map((item) => ({
          comment: item.comment,
          displayName: item.displayName || item.name,
          label: item.displayName || item.name,
          name: item.name,
          type: item.type,
          value: item.name,
        })) ?? [],
      );
    };

    void loadProperties();
  }, [networkId, objectTypeId]);

  useEffect(() => {
    if (!sourceKey || !value.actionSource) {
      loadedSourceKeyRef.current = "";
      setInputSchema([]);
      return;
    }

    if (loadedSourceKeyRef.current === sourceKey) {
      return;
    }

    const loadSchema = async () => {
      setSchemaLoading(true);
      try {
        const schema = await resolveActionTypeToolInputSchema(value.actionSource!);
        loadedSourceKeyRef.current = sourceKey;
        setInputSchema(schema);
        onChangeRef.current({
          ...valueRef.current,
          parameters: mergeExecutionParametersWithSchema(
            schema,
            valueRef.current.parameters,
          ),
        });
      } finally {
        setSchemaLoading(false);
      }
    };

    void loadSchema();
  }, [sourceKey, value.actionSource]);

  const hasSource = Boolean(getActionSourceDisplayName(value.actionSource) || value.sourceName.trim());

  const handleSourceChange = (nextSource: ActionTypeExecutionConfig["actionSource"]) => {
    loadedSourceKeyRef.current = "";
    setInputSchema([]);

    if (!nextSource) {
      onChange({
        ...value,
        actionSource: undefined,
        parameters: [],
        sourceName: "",
      });
      return;
    }

    onChange({
      ...value,
      actionSource: nextSource,
      parameters: [],
      sourceName: getActionSourceDisplayName(nextSource),
      sourceType: nextSource.type ?? value.sourceType,
    });
  };

  const handleSourceSelected = (nextSource: NonNullable<ActionTypeExecutionConfig["actionSource"]>) => {
    loadedSourceKeyRef.current = "";
    setInputSchema([]);
    onChange({
      ...value,
      actionSource: nextSource,
      parameters: [],
      sourceName: getActionSourceDisplayName(nextSource),
      sourceType: nextSource.type,
    });
  };

  const handleParametersChange = (parameters: ActionTypeExecutionParameter[]) => {
    onChange({
      ...value,
      parameters,
    });
  };

  return (
    <div className={styles.panel}>
      <div className={styles.operatorSection}>
        <div className={styles.operatorLabel}>{t("knowledgeNetwork.actionTypeOperatorLabel")}</div>
        <ActionTypeSourcePicker
          onChange={handleSourceChange}
          onSourceSelected={handleSourceSelected}
          value={value.actionSource}
        />
      </div>

      <ActionTypeToolParamsTable
        hasSource={hasSource}
        inputSchema={inputSchema}
        loading={schemaLoading}
        objectTypeId={objectTypeId}
        onChange={handleParametersChange}
        parameters={value.parameters}
        propertyOptions={propertyOptions}
      />
    </div>
  );
}
