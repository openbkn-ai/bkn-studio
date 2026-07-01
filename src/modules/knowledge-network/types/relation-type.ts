/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

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
  description: string;
  id: string;
  mappingMode: "direct" | "resource";
  name: string;
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
};

export type KnowledgeNetworkRelationTypeMutationPayload = {
  color: string;
  description: string;
  id?: string;
  mappingMode: "direct" | "resource";
  mappingRules?: RelationTypeMappingConfig;
  name: string;
  sourceObjectTypeId: string;
  tags: string[];
  targetObjectTypeId: string;
};
