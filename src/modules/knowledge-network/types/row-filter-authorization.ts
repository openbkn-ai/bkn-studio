/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for details.
 */

export type RowFilterSubjectType = "user" | "role";
export type RowFilterSubject = { id: string; type: RowFilterSubjectType };
export type RowFilterValueType = "string" | "integer" | "boolean";
export type RowFilterConditionOperator =
  | "between"
  | "gt"
  | "gte"
  | "in"
  | "lt"
  | "lte"
  | "not_in";

export type RowFilterCondition = {
  operator: RowFilterConditionOperator;
  propertyName: string;
  values: Array<string | number | boolean>;
};

export type RowFilterPolicy = {
  conditions: RowFilterCondition[];
  relation: "and" | "or";
};

export type RowFilterAvailableField = {
  displayName?: string;
  name: string;
  type: RowFilterValueType;
};

export type RowFilterSnapshot = {
  availableFields: RowFilterAvailableField[];
  objectTypeRef: string;
  policy: RowFilterPolicy | null;
  revision: string | null;
  subject: RowFilterSubject;
};

export type RowFilterPredicate = {
  kind: string;
  predicates?: RowFilterPredicate[];
  property?: string;
  values?: Array<string | number | boolean>;
};

export type RowFilterPolicySource = { policy: RowFilterPolicy; subject: RowFilterSubject };

export type RowFilterExplain = {
  directPolicy?: RowFilterPolicy;
  effectivePredicate?: RowFilterPredicate;
  effectiveRowFilterDigest: string;
  rolePolicies: RowFilterPolicySource[];
  rolePolicyOnly: boolean;
  snapshot: RowFilterSnapshot;
};

export type RowFilterPatch = {
  expectedRevision: string | null;
  objectTypeRef: string;
  policy: RowFilterPolicy | null;
  reason: string;
  subject: RowFilterSubject;
};
