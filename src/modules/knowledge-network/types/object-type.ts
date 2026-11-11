/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  DefinitionDeclarationEdit,
  DefinitionDeclarations,
  PropertyDeclarations,
} from "./declarations";

export type KnowledgeNetworkObjectTypeRecord = {
  color: string;
  conceptGroupIds: string[];
  conceptGroupNames: string[];
  dataSource?: ObjectTypeDataSource;
  /** Its aliases and lifecycle; absent when it declares neither. */
  declarations?: DefinitionDeclarations;
  description: string;
  hasIndex: boolean;
  indexStatus?: ObjectTypeIndexStatus;
  icon?: string;
  id: string;
  name: string;
  operations?: string[];
  tags: string[];
  updateTime: string;
  updaterName: string;
};

export type ObjectTypeIndexState =
  "available" | "unavailable" | "unknown" | "resource_missing" | "not_applicable";

export type ObjectTypeIndexStatus = {
  sourceStatus?: string;
  state: ObjectTypeIndexState;
};

export type ObjectTypeIndexFeature = {
  available: boolean | null;
  configured: boolean;
  type: "keyword" | "fulltext" | "vector";
};

export type ObjectTypeMappedField = {
  displayName: string;
  name: string;
  type: string;
};

export type ObjectTypeDataSource = {
  dataSourceId?: string;
  id: string;
  name: string;
  operations?: string[];
  type?: "resource";
};

export type ObjectTypeResourceGroup = {
  id: string;
  name: string;
  parentId?: string;
  selectable?: boolean;
  type: string;
};

export type ObjectTypeResourceListQuery = {
  dataSourceId?: string;
  name?: string;
  page?: number;
  pageSize?: number;
};

export type ObjectTypeResourceListResult = {
  items: ObjectTypeDataSource[];
  total: number;
};

export type ObjectTypeResourcePreview = {
  columns: Array<{
    dataIndex: string;
    title: string;
  }>;
  name: string;
  queryDenied?: boolean;
  rowTotalCount?: number;
  rows: Array<Record<string, string | number>>;
};

export type ObjectTypeResourceField = {
  comment?: string;
  displayName: string;
  name: string;
  type: string;
};

export type ObjectTypeFixedMaskRule = {
  kind: "fixed";
  replacement: string;
};

export type ObjectTypePartialMaskRule = {
  keepEnd: number;
  keepStart: number;
  kind: "partial";
  replacement: string;
};

export type ObjectTypeEmailMaskRule = {
  kind: "email";
  localKeepStart: number;
  preserveDomain: boolean;
  replacement: string;
};

export type ObjectTypeRoundMaskRule = {
  kind: "round";
  step: number;
};

export type ObjectTypeDateGranularityMaskRule = {
  granularity: "year" | "month" | "day" | "hour";
  kind: "date_granularity";
};

export type ObjectTypeMaskRule =
  | ObjectTypeFixedMaskRule
  | ObjectTypePartialMaskRule
  | ObjectTypeEmailMaskRule
  | ObjectTypeRoundMaskRule
  | ObjectTypeDateGranularityMaskRule;

export type ObjectTypeDataProperty = {
  comment?: string;
  /** BKN spec 3.0 declarations; absent when the property makes none. */
  declarations?: PropertyDeclarations;
  displayKey: boolean;
  displayName: string;
  incrementalKey: boolean;
  indexFeatures?: ObjectTypeIndexFeature[];
  maskRule?: ObjectTypeMaskRule;
  mappedField?: ObjectTypeMappedField;
  name: string;
  primaryKey: boolean;
  type: string;
};

export type ObjectTypeLogicAttributeType = "tool";

export type ObjectTypeLogicParameterValueFrom = "property" | "input" | "const";

export type ObjectTypeLogicParameter = {
  children?: ObjectTypeLogicParameter[];
  description?: string;
  id: string;
  ifSystemGenerate?: boolean;
  name: string;
  operation?: string;
  required?: boolean;
  source?: string;
  type?: string;
  value?: string | boolean | number;
  valueFrom: ObjectTypeLogicParameterValueFrom;
};

export type ObjectTypeLogicDataSource = {
  boxId?: string;
  id?: string;
  name?: string;
  resultPath?: string;
  toolId?: string;
  type: ObjectTypeLogicAttributeType;
};

export type ObjectTypeLogicProperty = {
  comment?: string;
  dataSource?: ObjectTypeLogicDataSource | null;
  displayName: string;
  name: string;
  parameters?: ObjectTypeLogicParameter[] | null;
  type?: string;
};

/**
 * The declarations the data properties had when the object type was read, by property name. A
 * save sends only the declarations that differ from them; a property without an entry, new or
 * without declarations, sends the declarations it has.
 */
export type DataPropertyDeclarationBaseline = ReadonlyMap<string, PropertyDeclarations>;

export type KnowledgeNetworkObjectTypeMutationPayload = {
  color: string;
  conceptGroupIds: string[];
  dataProperties?: ObjectTypeDataProperty[];
  /**
   * Present on a save that edits declarations; empty for a new object type. A save without it,
   * such as a mask rule save, sends no declaration and the backend keeps the stored ones.
   */
  declarationBaseline?: DataPropertyDeclarationBaseline;
  /** The aliases and lifecycle the form edits; absent on a save that does not edit them. */
  definitionDeclarationEdit?: DefinitionDeclarationEdit;
  dataSource?: ObjectTypeDataSource;
  description: string;
  icon?: string;
  id?: string;
  /**
   * The stored incremental key. Studio does not edit it, but a save replaces the whole object
   * type, so it is sent back; absent for a new object type.
   */
  incrementalKey?: string;
  logicProperties?: ObjectTypeLogicProperty[];
  name: string;
  tags: string[];
};

export type ObjectTypeDetail = KnowledgeNetworkObjectTypeRecord & {
  dataProperties: ObjectTypeDataProperty[];
  dataSource?: ObjectTypeDataSource;
  displayKey: string;
  incrementalKey: string;
  logicProperties: ObjectTypeLogicProperty[];
  primaryKeys: string[];
};

export type ObjectTypeSmallModel = {
  batchSize: number;
  embeddingDim: number;
  label: string;
  maxTokens: number;
  value: string;
};
