import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { getKnowledgeNetworkObjectTypeDetail } from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  ActionTypeExecutionConfig,
  ActionTypeExecutionParameter,
} from "@/modules/knowledge-network/types/knowledge-network";

import { ActionTypeParameterMappingTable } from "./ActionTypeParameterMappingTable";
import { ActionTypeSourcePicker } from "./ActionTypeSourcePicker";
import {
  buildParametersFromMockTool,
  buildMockToolFromSelection,
  findMockActionTool,
  getActionSourceDisplayName,
} from "./execution-utils";

import styles from "./ActionTypeExecutionEditor.module.css";

export {
  cloneActionTypeExecutionConfig,
  createDefaultActionTypeExecutionConfig,
  normalizeActionTypeExecutionConfig,
  validateActionTypeExecutionConfig,
} from "./execution-utils";

type ActionTypeExecutionEditorProps = {
  networkId: string;
  objectTypeId: string;
  value: ActionTypeExecutionConfig;
  onChange: (value: ActionTypeExecutionConfig) => void;
};

export function ActionTypeExecutionEditor({
  networkId,
  objectTypeId,
  value,
  onChange,
}: ActionTypeExecutionEditorProps) {
  const { t } = useTranslation();
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

  const hasSource = Boolean(getActionSourceDisplayName(value.actionSource) || value.sourceName.trim());

  const mockTool = useMemo(() => findMockActionTool(value.actionSource), [value.actionSource]);

  const parameterTypeByName = useMemo(
    () =>
      Object.fromEntries(
        (mockTool?.parameters ?? []).map((item) => [item.name, item.type ?? "string"]),
      ),
    [mockTool],
  );

  const handleSourceChange = (nextSource: ActionTypeExecutionConfig["actionSource"]) => {
    if (!nextSource) {
      onChange({
        ...value,
        actionSource: undefined,
        parameters: [],
        sourceName: "",
      });
      return;
    }

    const nextMockTool = findMockActionTool(nextSource);
    const nextParameters = nextMockTool ? buildParametersFromMockTool(nextMockTool) : [];

    onChange({
      ...value,
      actionSource: nextSource,
      parameters: nextParameters,
      sourceName: getActionSourceDisplayName(nextSource),
      sourceType: nextSource.type ?? value.sourceType,
    });
  };

  const handleSourceSelected = (
    nextSource: NonNullable<ActionTypeExecutionConfig["actionSource"]>,
    parameters: Array<{ name: string; required?: boolean; type?: string }>,
  ) => {
    const mockTool = buildMockToolFromSelection(nextSource, parameters);
    onChange({
      ...value,
      actionSource: nextSource,
      parameters: buildParametersFromMockTool(mockTool),
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

      <ActionTypeParameterMappingTable
        hasSource={hasSource}
        objectTypeId={objectTypeId}
        onChange={handleParametersChange}
        parameterTypeByName={parameterTypeByName}
        parameters={value.parameters}
        propertyOptions={propertyOptions}
      />
    </div>
  );
}
