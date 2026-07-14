/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/* eslint-disable react-refresh/only-export-components */

import type { KnowledgeNetworkObjectTypeRecord } from "@/modules/knowledge-network/types/knowledge-network";

import { RelationTypeResourceMappingRules } from "./RelationTypeResourceMappingRules";
import { RelationTypeDirectMappingRules } from "./RelationTypeDirectMappingRules";
import {
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
      resourceName={
        value.mappingRules.backingDataSourceName || value.mappingRules.backingDataSourceId
      }
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
