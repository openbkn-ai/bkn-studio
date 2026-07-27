/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/* eslint-disable react-refresh/only-export-components */

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { getKnowledgeNetworkObjectTypeDetail } from "@/modules/knowledge-network/services/knowledge-network.service";
import {
  needsActionTypeActionSourceDisplayResolution,
  resolveActionTypeActionSourceDisplay,
  resolveActionTypeToolInputSchema,
} from "@/modules/knowledge-network/services/action-type-tool.service";
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

type DisplayResolutionStatus = "failed" | "idle" | "loading";

const DISPLAY_RESOLUTION_TIMEOUT_MS = 3000;

function buildActionSourceKey(actionSource?: ActionTypeExecutionConfig["actionSource"]) {
  if (!actionSource) {
    return "";
  }

  if (actionSource.type === "mcp") {
    const toolKey = actionSource.toolId || actionSource.toolName;
    return actionSource.mcpId && toolKey
      ? `mcp:${actionSource.mcpId}:${toolKey}`
      : "";
  }

  return actionSource.boxId && actionSource.toolId
    ? `tool:${actionSource.boxId}:${actionSource.toolId}`
    : "";
}

async function withDisplayResolutionTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("Action source display resolution timed out")),
      DISPLAY_RESOLUTION_TIMEOUT_MS,
    );
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
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
  const resolvedDisplaySourceKeyRef = useRef("");
  const displayActionSourceRef = useRef<ActionTypeExecutionConfig["actionSource"]>(
    value.actionSource,
  );
  const [displayActionSource, setDisplayActionSource] =
    useState<ActionTypeExecutionConfig["actionSource"]>(value.actionSource);
  const [inputSchema, setInputSchema] = useState<ActionTypeToolInputParam[]>([]);
  const [displayResolutionStatus, setDisplayResolutionStatus] =
    useState<DisplayResolutionStatus>(() =>
      needsActionTypeActionSourceDisplayResolution(value.actionSource)
        ? "loading"
        : "idle",
    );
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
  displayActionSourceRef.current = displayActionSource;

  const sourceKey = useMemo(
    () => buildActionSourceKey(value.actionSource),
    [value.actionSource],
  );
  const sourceNeedsDisplayResolution = needsActionTypeActionSourceDisplayResolution(
    value.actionSource,
  );
  const displaySourceNeedsResolution =
    needsActionTypeActionSourceDisplayResolution(displayActionSource);

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
      resolvedDisplaySourceKeyRef.current = "";
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

  useEffect(() => {
    const actionSource = valueRef.current.actionSource;
    if (!sourceKey || !actionSource) {
      resolvedDisplaySourceKeyRef.current = "";
      setDisplayActionSource(actionSource);
      setDisplayResolutionStatus("idle");
      return;
    }

    if (!sourceNeedsDisplayResolution) {
      resolvedDisplaySourceKeyRef.current = sourceKey;
      setDisplayActionSource(actionSource);
      setDisplayResolutionStatus("idle");
      return;
    }

    if (
      resolvedDisplaySourceKeyRef.current === sourceKey &&
      !needsActionTypeActionSourceDisplayResolution(displayActionSourceRef.current)
    ) {
      setDisplayResolutionStatus("idle");
      return;
    }

    let cancelled = false;
    setDisplayActionSource(actionSource);
    setDisplayResolutionStatus("loading");

    const resolveDisplay = async () => {
      try {
        const resolvedSource = await withDisplayResolutionTimeout(
          resolveActionTypeActionSourceDisplay(actionSource),
        );
        if (cancelled) {
          return;
        }

        const nextSourceName = getActionSourceDisplayName(resolvedSource);
        const currentSourceName = getActionSourceDisplayName(valueRef.current.actionSource);
        setDisplayActionSource(resolvedSource);
        resolvedDisplaySourceKeyRef.current = sourceKey;
        if (!nextSourceName || nextSourceName === currentSourceName) {
          setDisplayResolutionStatus(
            needsActionTypeActionSourceDisplayResolution(resolvedSource)
              ? "failed"
              : "idle",
          );
          return;
        }

        onChangeRef.current({
          ...valueRef.current,
          actionSource: resolvedSource,
          sourceName: nextSourceName,
          sourceType: resolvedSource.type,
        });
        setDisplayResolutionStatus("idle");
      } catch {
        if (!cancelled) {
          resolvedDisplaySourceKeyRef.current = sourceKey;
          setDisplayResolutionStatus("failed");
        }
      }
    };

    void resolveDisplay();

    return () => {
      cancelled = true;
    };
  }, [sourceKey, sourceNeedsDisplayResolution]);

  const hasSource = Boolean(getActionSourceDisplayName(value.actionSource) || value.sourceName.trim());

  const handleSourceChange = (nextSource: ActionTypeExecutionConfig["actionSource"]) => {
    loadedSourceKeyRef.current = "";
    resolvedDisplaySourceKeyRef.current = "";
    setDisplayActionSource(nextSource);
    setDisplayResolutionStatus("idle");
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
    resolvedDisplaySourceKeyRef.current = "";
    setDisplayActionSource(nextSource);
    setDisplayResolutionStatus("idle");
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
          loading={displayResolutionStatus === "loading"}
          onChange={handleSourceChange}
          onSourceSelected={handleSourceSelected}
          unresolved={
            displayResolutionStatus === "failed" &&
            sourceNeedsDisplayResolution &&
            displaySourceNeedsResolution
          }
          value={displayActionSource}
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
