/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { KnowledgeNetworkActionTypeKind } from "./action-type";

export type ConceptGroupRelatedResourceRef = {
  color?: string;
  icon?: string;
  id: string;
  name: string;
};

export type ConceptGroupRecord = {
  actionTypesTotal: number;
  color?: string;
  description: string;
  id: string;
  name: string;
  objectTypesTotal: number;
  relationTypesTotal: number;
  tags?: string[];
  updateTime: string;
  updaterName?: string;
};

export type ConceptGroupRelatedItem = {
  actionKind?: KnowledgeNetworkActionTypeKind;
  boundObjectType?: ConceptGroupRelatedResourceRef;
  color?: string;
  description: string;
  icon?: string;
  id: string;
  name: string;
  sourceObjectType?: ConceptGroupRelatedResourceRef;
  tags: string[];
  targetObjectType?: ConceptGroupRelatedResourceRef;
};

export type ConceptGroupDetail = ConceptGroupRecord & {
  actionTypes: ConceptGroupRelatedItem[];
  objectTypes: ConceptGroupRelatedItem[];
  relationTypes: ConceptGroupRelatedItem[];
};

export type ConceptGroupMutationPayload = {
  color: string;
  description: string;
  name: string;
  tags: string[];
};
