import { useMemo } from "react";

import type { KnowledgeNetworkObjectTypeRecord } from "@/modules/knowledge-network/types/knowledge-network";

import { RelationTypeResourceMappingRules } from "./RelationTypeResourceMappingRules";
import { RelationTypeDirectMappingRules } from "./RelationTypeDirectMappingRules";
import {
  countValidResourceMappings,
  resetMappingRulesForMode,
  type RelationTypeMappingFormValues,
} from "./mapping-utils";
import { RelationTypeMappingShell } from "./RelationTypeMappingShell";

export type { RelationTypeMappingFormValues } from "./mapping-utils";

type RelationTypeMappingEditorProps = {
  mappingModeField?: boolean;
  networkId: string;
  objectTypes: KnowledgeNetworkObjectTypeRecord[];
  value: RelationTypeMappingFormValues;
  onChange: (value: RelationTypeMappingFormValues) => void;
};

export {
  buildRelationTypeMappingRulesFromDetail,
  createDefaultRelationTypeMappingValues,
  normalizeRelationTypeMappingValues,
  validateRelationTypeMappingValues,
} from "./mapping-utils";

export function RelationTypeMappingEditor({
  mappingModeField = true,
  networkId,
  objectTypes,
  value,
  onChange,
}: RelationTypeMappingEditorProps) {
  const mappingSummaryCount = useMemo(() => {
    if (value.mappingMode === "resource") {
      return countValidResourceMappings(value.mappingRules.resourceMappings);
    }

    return value.mappingRules.propertyMappings.filter(
      (item) => item.sourcePropertyName && item.targetPropertyName,
    ).length;
  }, [value.mappingMode, value.mappingRules.resourceMappings, value.mappingRules.propertyMappings]);

  const handleMappingModeChange = (mode: "direct" | "resource") => {
    if (mode === value.mappingMode) {
      return;
    }

    onChange({
      mappingMode: mode,
      mappingRules: resetMappingRulesForMode(mode),
    });
  };

  const handleMappingRulesChange = (mappingRules: RelationTypeMappingFormValues["mappingRules"]) => {
    onChange({
      ...value,
      mappingRules,
    });
  };

  return (
    <RelationTypeMappingShell
      mappingMode={value.mappingMode}
      mappingModeField={mappingModeField}
      objectTypes={objectTypes}
      onMappingModeChange={handleMappingModeChange}
      propertyMappingCount={mappingSummaryCount}
      sourceObjectTypeId={value.mappingRules.sourceObjectTypeId}
      targetObjectTypeId={value.mappingRules.targetObjectTypeId}
    >
      {value.mappingMode === "direct" ? (
        <RelationTypeDirectMappingRules
          networkId={networkId}
          objectTypes={objectTypes}
          onChange={handleMappingRulesChange}
          value={value.mappingRules}
        />
      ) : (
        <RelationTypeResourceMappingRules
          networkId={networkId}
          objectTypes={objectTypes}
          onChange={handleMappingRulesChange}
          value={value.mappingRules}
        />
      )}
    </RelationTypeMappingShell>
  );
}
