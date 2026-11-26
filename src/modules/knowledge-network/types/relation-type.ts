/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  DefinitionDeclarationEdit,
  DefinitionDeclarations,
  RelationDeclarations,
} from "./declarations";

export type RelationTypePropertyMapping = {
  sourcePropertyName: string;
  targetPropertyName: string;
};

export type RelationTypeResourceRowMapping = {
  resourceSourcePropertyName: string;
  resourceTargetPropertyName: string;
  sourceObjectPropertyName: string;
  targetObjectPropertyName: string;
};

export type RelationTypeMappingConfig = {
  backingDataSourceId: string;
  backingDataSourceName?: string;
  /** Defined when this save edits relation properties, including an explicit empty list. */
  relationProperties?: StoredRelationProperty[];
  resourceMappings: RelationTypeResourceRowMapping[];
  propertyMappings: RelationTypePropertyMapping[];
  sourceObjectTypeId: string;
  targetObjectTypeId: string;
};

export type RelationTypeResourceMappingStore = {
  relationProperties?: StoredRelationProperty[];
  backingDataSourceId: string;
  backingDataSourceName?: string;
  resourceMappings: RelationTypeResourceRowMapping[];
};

export type KnowledgeNetworkRelationTypeRecord = {
  color: string;
  /** BKN spec 3.0 declarations; absent when the relation type makes none. */
  declarations?: RelationDeclarations;
  /**
   * Its aliases and lifecycle, which every kind of definition has; absent when it declares
   * neither. A deprecated relation is no fallback path's primary.
   */
  definitionDeclarations?: DefinitionDeclarations;
  description: string;
  id: string;
  mappingMode: "direct" | "resource";
  name: string;
  operations?: string[];
  sourceObjectTypeId: string;
  sourceObjectTypeName: string;
  tags: string[];
  targetObjectTypeId: string;
  targetObjectTypeName: string;
  updateTime: string;
  updaterName: string;
};

export type RelationTypeDetail = KnowledgeNetworkRelationTypeRecord & {
  backingDataSourceId?: string;
  backingDataSourceName?: string;
  resourceMappings: RelationTypeResourceRowMapping[];
  propertyMappings: RelationTypePropertyMapping[];
  /** The relation properties stored in `mapping_rules.properties`. */
  relationProperties?: StoredRelationProperty[];
};

/** Editable relation fields together with their complete saved declaration. */
export type StoredRelationProperty = {
  constraints?: Record<string, unknown> & {
    range?: {
      min?: number | string;
      max?: number | string;
      [key: string]: unknown;
    };
  };
  /** Retains declaration fields the property editor does not expose. */
  declaration?: Record<string, unknown>;
  displayName?: string;
  mappedField?: string;
  name: string;
  required?: boolean;
  type?: string;
};

/** The declarations a save edits, and what they were when the relation type was read. */
export type RelationDeclarationEdit = {
  /** Absent for a new relation type, or one that made no declaration. */
  baseline?: RelationDeclarations;
  current?: RelationDeclarations;
};

export type KnowledgeNetworkRelationTypeMutationPayload = {
  color: string;
  /**
   * Present on a save that edits declarations. A save without it, such as the mapping page's,
   * sends no declaration and the backend keeps the stored ones.
   */
  declarationEdit?: RelationDeclarationEdit;
  /** Present on a save that edits the aliases or lifecycle, as `declarationEdit` is. */
  definitionDeclarationEdit?: DefinitionDeclarationEdit;
  description: string;
  id?: string;
  mappingMode: "direct" | "resource";
  mappingRules?: RelationTypeMappingConfig;
  name: string;
  sourceObjectTypeId: string;
  tags: string[];
  targetObjectTypeId: string;
};
