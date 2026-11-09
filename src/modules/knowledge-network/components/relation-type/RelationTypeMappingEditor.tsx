/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/* eslint-disable react-refresh/only-export-components */

import { listObjectTypeResourceFields } from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  KnowledgeNetworkObjectTypeRecord,
  ObjectTypeDataSource,
  StoredRelationProperty,
} from "@/modules/knowledge-network/types/knowledge-network";

import { RelationTypeResourceMappingRules } from "./RelationTypeResourceMappingRules";
import { RelationTypeDirectMappingRules } from "./RelationTypeDirectMappingRules";
import {
  resetMappingRulesForMode,
  type RelationTypeMappingFormValues,
  type RelationTypeMappingReaders,
} from "./mapping-utils";
import { RelationTypeMappingShell } from "./RelationTypeMappingShell";

export type {
  RelationTypeMappingField,
  RelationTypeMappingFormValues,
  RelationTypeMappingReaders,
} from "./mapping-utils";

/** A mapping change that would lose or break the relation properties an indirect relation stores. */
export type RelationPropertyChange =
  | { count: number; kind: "toDirect" }
  | {
      count: number;
      kind: "resource";
      /** The relation properties whose column the new resource does not have. */
      missing: StoredRelationProperty[];
      resourceName: string;
    };

type RelationTypeMappingEditorProps = {
  /** Asks before a change that `relationProperties` would not survive; true goes ahead. */
  confirmRelationPropertyChange?: (change: RelationPropertyChange) => Promise<boolean>;
  mappingModeField?: boolean;
  networkId: string;
  objectTypes: KnowledgeNetworkObjectTypeRecord[];
  /** Reads properties and fields from elsewhere than the network, as a project's draft does. */
  readers?: RelationTypeMappingReaders;
  /** The relation properties the relation stores, which Studio does not edit yet. */
  relationProperties?: StoredRelationProperty[];
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
  confirmRelationPropertyChange,
  mappingModeField = true,
  networkId,
  objectTypes,
  readers,
  relationProperties = [],
  value,
  onChange,
}: RelationTypeMappingEditorProps) {
  const guarded = confirmRelationPropertyChange && relationProperties.length > 0;

  const handleMappingModeChange = (mode: "direct" | "resource") => {
    if (mode === value.mappingMode) {
      return;
    }

    void (async () => {
      // A direct relation has no relation properties: the backend drops the stored ones.
      if (
        guarded &&
        mode === "direct" &&
        !(await confirmRelationPropertyChange({
          count: relationProperties.length,
          kind: "toDirect",
        }))
      ) {
        return;
      }
      onChange({
        mappingMode: mode,
        mappingRules: resetMappingRulesForMode(mode),
      });
    })();
  };

  // The stored relation properties read columns by name, and the backend checks them against the
  // new resource: say which ones it lacks before the change.
  const beforeResourceChange = guarded
    ? async (resource: ObjectTypeDataSource) => {
        const fields = await (
          readers
            ? readers.readResourceFields(resource.id)
            : listObjectTypeResourceFields(networkId, resource.id)
        ).catch(() => undefined);
        const missing = fields
          ? relationProperties.filter(
              (property) =>
                property.mappedField &&
                !fields.some((field) => field.name === property.mappedField),
            )
          : [];
        return confirmRelationPropertyChange({
          count: relationProperties.length,
          kind: "resource",
          missing,
          resourceName: resource.name || resource.id,
        });
      }
    : undefined;

  const handleMappingRulesChange = (
    mappingRules: RelationTypeMappingFormValues["mappingRules"],
  ) => {
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
          readers={readers}
          onChange={handleMappingRulesChange}
          value={value.mappingRules}
        />
      ) : (
        <RelationTypeResourceMappingRules
          beforeResourceChange={beforeResourceChange}
          networkId={networkId}
          objectTypes={objectTypes}
          readers={readers}
          onChange={handleMappingRulesChange}
          value={value.mappingRules}
        />
      )}
    </RelationTypeMappingShell>
  );
}
