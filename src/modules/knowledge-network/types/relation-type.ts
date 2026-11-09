/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { RelationDeclarations } from "./declarations";

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
  resourceMappings: RelationTypeResourceRowMapping[];
  propertyMappings: RelationTypePropertyMapping[];
  sourceObjectTypeId: string;
  targetObjectTypeId: string;
};

export type RelationTypeResourceMappingStore = {
  backingDataSourceId: string;
  backingDataSourceName?: string;
  resourceMappings: RelationTypeResourceRowMapping[];
};

export type KnowledgeNetworkRelationTypeRecord = {
  color: string;
  /** BKN spec 3.0 declarations; absent when the relation type makes none. */
  declarations?: RelationDeclarations;
  /** BKN spec 3.0 lifecycle `deprecated`. A deprecated relation is no fallback path's primary. */
  deprecated?: boolean;
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
  /**
   * The relation properties an indirect relation stores (`mapping_rules.properties`). Studio does
   * not edit them yet, and a save never sends them, so the backend keeps them.
   */
  relationProperties?: StoredRelationProperty[];
};

/** A stored relation property, by what names it: its name and the backing resource column. */
export type StoredRelationProperty = {
  displayName?: string;
  mappedField?: string;
  name: string;
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
  description: string;
  id?: string;
  mappingMode: "direct" | "resource";
  mappingRules?: RelationTypeMappingConfig;
  name: string;
  sourceObjectTypeId: string;
  tags: string[];
  targetObjectTypeId: string;
};
