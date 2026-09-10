/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type PropertyAccessLevel = "none" | "schema" | "masked" | "full";
export type PropertyAccessSelection = "inherit" | PropertyAccessLevel;
export type PropertyGrantSubjectType = "user" | "role";

export type PropertyGrantSubject = {
  id: string;
  type: PropertyGrantSubjectType;
};

export type PropertyGrantEntry = {
  createdAt?: string;
  createdBy?: string;
  expiresAt?: string;
  level: PropertyAccessLevel;
  propertyName: string;
  source?: string;
  sourceRef?: string;
  updatedAt?: string;
};

export type PropertyAccessDecision = {
  level: PropertyAccessLevel;
  name: string;
  source: string;
};

export type PropertyGrantSnapshot = {
  accessor: PropertyGrantSubject;
  decisions?: PropertyAccessDecision[];
  entries: PropertyGrantEntry[];
  objectTypeRef: string;
};

export type PropertyGrantChange = {
  expiresAt?: string;
  level: PropertyAccessSelection;
  propertyName: string;
  source?: string;
  sourceRef?: string;
};

export type PropertyGrantPatch = {
  accessor: PropertyGrantSubject;
  changes: PropertyGrantChange[];
  objectTypeRef: string;
  reason: string;
};

export type PropertyGrantPatchResult = PropertyGrantSnapshot & {
  changed: number;
};
