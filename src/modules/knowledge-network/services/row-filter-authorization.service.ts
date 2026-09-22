/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for details.
 */

import { http } from "@/framework/request/http";
import type {
  RowFilterCondition,
  RowFilterExplain,
  RowFilterPatch,
  RowFilterPolicy,
  RowFilterSnapshot,
  RowFilterSubject,
  RowFilterValueType,
} from "@/modules/knowledge-network/types/row-filter-authorization";

const useMock = import.meta.env.VITE_USE_MOCK !== "false";
const ROW_FILTER_POLICIES = "/safe/v1/admin/row-filter-policies";
const ROW_FILTER_EXPLAIN = `${ROW_FILTER_POLICIES}/explain`;

type BackendCondition = {
  operator: RowFilterCondition["operator"];
  property_name: string;
  values: Array<string | number | boolean>;
};
type BackendPolicy = { conditions: BackendCondition[]; relation: "and" | "or" };
type BackendSnapshot = {
  available_fields?: Array<{ display_name?: string; name: string; type: RowFilterValueType }>;
  object_type_ref: string;
  policy?: BackendPolicy | null;
  revision?: string | null;
  subject: RowFilterSubject;
};
type BackendExplain = {
  direct_policy?: BackendPolicy;
  effective_predicate?: RowFilterExplain["effectivePredicate"];
  effective_row_filter_digest?: string;
  role_policies?: Array<{ policy: BackendPolicy; subject: RowFilterSubject }>;
  role_policy_only?: boolean;
  snapshot: BackendSnapshot;
};

const mockPolicies = new Map<string, { policy: RowFilterPolicy; revision: string }>();
let mockRevision = 0;

function snapshotKey(subject: RowFilterSubject, objectTypeRef: string) {
  return `${subject.type}:${subject.id}:${objectTypeRef}`;
}

function mapPolicy(policy?: BackendPolicy | null): RowFilterPolicy | null {
  return policy
    ? {
        relation: policy.relation,
        conditions: policy.conditions.map((condition) => ({
          operator: condition.operator,
          propertyName: condition.property_name,
          values: condition.values,
        })),
      }
    : null;
}

function toBackendPolicy(policy: RowFilterPolicy): BackendPolicy {
  return {
    relation: policy.relation,
    conditions: policy.conditions.map((condition) => ({
      operator: condition.operator,
      property_name: condition.propertyName,
      values: condition.values,
    })),
  };
}

function mapSnapshot(snapshot: BackendSnapshot): RowFilterSnapshot {
  return {
    availableFields: (snapshot.available_fields ?? []).map((field) => ({
      displayName: field.display_name,
      name: field.name,
      type: field.type,
    })),
    objectTypeRef: snapshot.object_type_ref,
    policy: mapPolicy(snapshot.policy),
    revision: snapshot.revision ?? null,
    subject: snapshot.subject,
  };
}

function mockSnapshot(subject: RowFilterSubject, objectTypeRef: string): RowFilterSnapshot {
  const current = mockPolicies.get(snapshotKey(subject, objectTypeRef));
  return {
    availableFields: [
      { displayName: "Salesperson", name: "salesperson", type: "string" },
      { displayName: "Owning department name", name: "department_name", type: "string" },
      { displayName: "Sales region", name: "region", type: "string" },
      { displayName: "Priority", name: "priority", type: "integer" },
      { displayName: "Active", name: "is_active", type: "boolean" },
    ],
    objectTypeRef,
    policy: current?.policy ?? null,
    revision: current?.revision ?? null,
    subject,
  };
}

function mockPredicate(policy: RowFilterPolicy | null) {
  if (!policy) return { kind: "true" };
  return {
    kind: policy.relation,
    predicates: policy.conditions.map((condition) => ({
      kind: condition.operator,
      property: condition.propertyName,
      values: condition.values,
    })),
  };
}

export async function getRowFilterSnapshot(
  subject: RowFilterSubject,
  objectTypeRef: string,
): Promise<RowFilterSnapshot> {
  if (useMock) return mockSnapshot(subject, objectTypeRef);
  const response = await http.get<BackendSnapshot>(ROW_FILTER_POLICIES, {
    params: { object_type_ref: objectTypeRef, subject_id: subject.id, subject_type: subject.type },
  });
  return mapSnapshot(response.data);
}

export async function patchRowFilterPolicy(patch: RowFilterPatch): Promise<RowFilterSnapshot> {
  if (useMock) {
    const key = snapshotKey(patch.subject, patch.objectTypeRef);
    const current = mockPolicies.get(key);
    if ((current?.revision ?? null) !== patch.expectedRevision) {
      const error = new Error("revision_conflict");
      Object.assign(error, { isAxiosError: true, response: { status: 409 } });
      throw error;
    }
    if (patch.policy) {
      mockRevision += 1;
      mockPolicies.set(key, { policy: patch.policy, revision: String(mockRevision) });
    } else {
      mockPolicies.delete(key);
    }
    return mockSnapshot(patch.subject, patch.objectTypeRef);
  }
  const response = await http.patch<BackendSnapshot>(ROW_FILTER_POLICIES, {
    expected_revision: patch.expectedRevision,
    object_type_ref: patch.objectTypeRef,
    policy: patch.policy ? toBackendPolicy(patch.policy) : null,
    reason: patch.reason,
    subject: patch.subject,
  });
  return mapSnapshot(response.data);
}

export async function explainRowFilter(
  subject: RowFilterSubject,
  objectTypeRef: string,
): Promise<RowFilterExplain> {
  if (useMock) {
    const snapshot = mockSnapshot(subject, objectTypeRef);
    return {
      directPolicy: snapshot.policy ?? undefined,
      effectivePredicate: mockPredicate(snapshot.policy),
      effectiveRowFilterDigest: snapshot.policy ? `mock-${snapshot.revision}` : "mock-true",
      rolePolicies: [],
      rolePolicyOnly: subject.type === "role",
      snapshot,
    };
  }
  const response = await http.post<BackendExplain>(ROW_FILTER_EXPLAIN, {
    object_type_ref: objectTypeRef,
    subject,
  });
  return {
    directPolicy: mapPolicy(response.data.direct_policy) ?? undefined,
    effectivePredicate: response.data.effective_predicate,
    effectiveRowFilterDigest: response.data.effective_row_filter_digest ?? "",
    rolePolicies: (response.data.role_policies ?? []).map((source) => ({
      policy: mapPolicy(source.policy) as RowFilterPolicy,
      subject: source.subject,
    })),
    rolePolicyOnly: response.data.role_policy_only ?? false,
    snapshot: mapSnapshot(response.data.snapshot),
  };
}
