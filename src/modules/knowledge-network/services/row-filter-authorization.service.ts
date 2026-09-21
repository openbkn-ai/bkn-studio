/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import type {
  RowFilterExplain,
  RowFilterPatch,
  RowFilterPolicy,
  RowFilterSnapshot,
  RowFilterSubject,
  RowFilterTemplate,
  RowFilterValueType,
} from "@/modules/knowledge-network/types/row-filter-authorization";

const useMock = import.meta.env.VITE_USE_MOCK !== "false";
const ROW_FILTER_POLICIES = "/safe/v1/admin/row-filter-policies";

type BackendPolicy = {
  property_name?: string;
  template: RowFilterTemplate;
  values?: Array<string | number | boolean>;
};

type BackendSnapshot = {
  available_fields?: Array<{ name: string; type: RowFilterValueType }>;
  available_templates?: RowFilterTemplate[];
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
    ? { propertyName: policy.property_name, template: policy.template, values: policy.values }
    : null;
}

function mapSnapshot(snapshot: BackendSnapshot): RowFilterSnapshot {
  return {
    availableFields: snapshot.available_fields ?? [],
    availableTemplates: snapshot.available_templates ?? [],
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
      { name: "owner_user_id", type: "string" },
      { name: "department_id", type: "string" },
      { name: "region", type: "string" },
      { name: "priority", type: "integer" },
      { name: "is_active", type: "boolean" },
    ],
    availableTemplates: [
      "all_rows",
      "self",
      "department",
      "department_tree",
      "value_set",
      "no_rows",
    ],
    objectTypeRef,
    policy: current?.policy ?? null,
    revision: current?.revision ?? null,
    subject,
  };
}

export async function getRowFilterSnapshot(
  subject: RowFilterSubject,
  objectTypeRef: string,
): Promise<RowFilterSnapshot> {
  if (useMock) {
    return mockSnapshot(subject, objectTypeRef);
  }
  const response = await http.get<BackendSnapshot>(ROW_FILTER_POLICIES, {
    params: {
      object_type_ref: objectTypeRef,
      subject_id: subject.id,
      subject_type: subject.type,
    },
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
    policy: patch.policy
      ? {
          property_name: patch.policy.propertyName,
          template: patch.policy.template,
          values: patch.policy.values,
        }
      : null,
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
      effectivePredicate: snapshot.policy
        ? {
            kind: snapshot.policy.template,
            property: snapshot.policy.propertyName,
            values: snapshot.policy.values,
          }
        : { kind: "true" },
      effectiveRowFilterDigest: snapshot.policy ? `mock-${snapshot.revision}` : "mock-true",
      rolePolicies: [],
      rolePolicyOnly: subject.type === "role",
      snapshot,
    };
  }
  const response = await http.post<BackendExplain>(ROW_FILTER_POLICIES, {
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
