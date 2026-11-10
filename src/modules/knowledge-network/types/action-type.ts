/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { DefinitionDeclarationEdit, DefinitionDeclarations } from "./declarations";

export type ActionTypeOperationKind = "object" | "relation" | "tool";

export type ActionTypeOperationConfig =
  | { type: "object" | "tool" }
  | {
      type: "relation";
      relationTypeId: string;
      relationOperation: "create" | "delete";
      anchorRole?: "source" | "target";
      otherObjectCondition?: ActionTypeCondition;
    };

export type KnowledgeNetworkActionTypeKind = "create" | "update" | "delete" | "notify";

export type ActionTypeConditionOperation =
  | "and"
  | "or"
  | "=="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<="
  | "in"
  | "not_in"
  | "range"
  | "out_range"
  | "exist"
  | "not_exist";

export type ActionTypeCondition = {
  field?: string;
  objectTypeId?: string;
  operation?: ActionTypeConditionOperation;
  subConditions?: ActionTypeCondition[];
  value?: string | string[];
  /** For references, value is a property name or an action runtime parameter name. */
  valueFrom?: "const" | "property" | "input";
};

export type ActionTypeAffect = {
  comment?: string;
  objectTypeId?: string;
};

export type ActionTypeSourceKind = "manual" | "mcp" | "tool";

export type ActionTypeActionSource = {
  boxId?: string;
  boxName?: string;
  mcpId?: string;
  mcpName?: string;
  toolId?: string;
  toolName?: string;
  type: ActionTypeSourceKind;
};

export type ActionTypeExecutionParameterValueFrom =
  "const" | "input" | "property" | "source_identity" | "target_identity";

export type ActionTypeExecutionParameter = {
  description?: string;
  name: string;
  source?: string;
  sourcePropertyName?: string;
  type?: string;
  value?: string;
  valueFrom?: ActionTypeExecutionParameterValueFrom;
};

export type ActionTypeExecutionConfig = {
  actionSource?: ActionTypeActionSource;
  parameters: ActionTypeExecutionParameter[];
  sourceName: string;
  sourceType: ActionTypeSourceKind;
};

export type KnowledgeNetworkActionTypeRecord = {
  operationConfig?: ActionTypeOperationConfig;
  actionKind: KnowledgeNetworkActionTypeKind;
  color: string;
  /** Its aliases and lifecycle; absent when it declares neither. */
  declarations?: DefinitionDeclarations;
  description: string;
  id: string;
  name: string;
  objectTypeId: string;
  objectTypeName: string;
  operations?: string[];
  tags: string[];
  updateTime: string;
  updaterName: string;
};

export type ActionTypeDetail = KnowledgeNetworkActionTypeRecord & {
  affect?: ActionTypeAffect;
  condition?: ActionTypeCondition;
  executionConfig: ActionTypeExecutionConfig;
};

export type KnowledgeNetworkActionTypeMutationPayload = {
  operationConfig?: ActionTypeOperationConfig;
  actionKind: KnowledgeNetworkActionTypeKind;
  affect?: ActionTypeAffect;
  color: string;
  condition?: ActionTypeCondition;
  /** The aliases and lifecycle the form edits; absent on a save that does not edit them. */
  definitionDeclarationEdit?: DefinitionDeclarationEdit;
  description: string;
  executionConfig?: ActionTypeExecutionConfig;
  id?: string;
  name: string;
  objectTypeId: string;
  tags: string[];
};

export type ActionTypeExecutionStatus =
  "pending" | "running" | "completed" | "failed" | "cancelled";

export type ActionTypeExecutionLog = {
  actionTypeId: string;
  actionTypeName: string;
  durationMs: number;
  failedCount: number;
  id: string;
  startTime: string;
  status: ActionTypeExecutionStatus;
  successCount: number;
  totalCount: number;
  triggerType: string;
};

export type ActionTypeExecutionLogQuery = {
  actionTypeId?: string;
  keyword?: string;
  limit?: number;
  offset?: number;
  status?: ActionTypeExecutionStatus | "";
  triggerType?: string;
};

export type ActionTypeExecutionLogResultStatus = "cancelled" | "failed" | "pending" | "success";

export type ActionTypeExecutionLogResultItem = {
  displayName?: string;
  durationMs?: number;
  errorMessage?: string;
  status: ActionTypeExecutionLogResultStatus;
};

/** Results the results endpoint can filter by; an empty value means every status. */
export type ActionTypeExecutionResultStatusFilter = "" | "cancelled" | "failed" | "success";

export type ActionTypeExecutionResultQuery = {
  limit: number;
  offset: number;
  status?: ActionTypeExecutionResultStatusFilter;
};

export type ActionTypeExecutionResultPage = {
  entries: ActionTypeExecutionLogResultItem[];
  totalCount: number;
};

export type ActionTypeExecutionLogDetail = ActionTypeExecutionLog & {
  endTime?: string;
  executorName?: string;
  results?: ActionTypeExecutionLogResultItem[];
  /** How many results the execution has; `results` holds only the detail response's first page. */
  resultsTotal?: number;
};

export type ActionTypeExecutionLogListResult = {
  entries: ActionTypeExecutionLog[];
  totalCount: number;
};
