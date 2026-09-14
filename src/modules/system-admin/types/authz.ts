/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

// Object-level authorization integrates with bkn-safe's `/api/safe/v1/admin/object-grants`.
// It supplements RBAC (roles -> permissions) by directly granting selected operations on a
// concrete object, such as a catalog, model, or operator, to one user.
//
// The list endpoint returns two deliberately different layers:
//   - grants: independently revocable source records, each identified by a stable grant_id;
//   - effective_decisions: the backend-computed result after deny, inheritance, bundles and requires.
// Studio must never merge source records or recompute the effective result locally.

export type GrantEffect = "allow" | "deny";

export type GrantPolicySource =
  | "community_bundle"
  | "professional_rule"
  | "legacy"
  | "system_derived"
  | "role_permission";

export type GrantAuthoritySource = "admin_authz" | "owner_delegate" | "system" | "migration";

export type EffectiveDecisionBasis =
  | "direct"
  | "inherited"
  | "bundle"
  | "wildcard"
  | "default"
  | "requires";

export type GrantRecord = {
  active: boolean;
  accessorId: string;
  authoritySource: GrantAuthoritySource;
  effect: GrantEffect;
  grantId: string;
  inherited: boolean;
  operation: string;
  policySource: GrantPolicySource;
};

export type EffectiveDecision = {
  basis: EffectiveDecisionBasis;
  decision: GrantEffect;
  deniedRequirement?: string;
  inheritedFrom?: { operation: string; resource: { id: string; type: string } };
  operation: string;
  requirementBasis?: EffectiveDecisionBasis;
  requires: string[];
};

/** One object-level grant that gives a user selected operations on an object. */
export type ObjectGrant = {
  /** Grantee user ID (backend accessor_id). */
  accessorId: string;
  objId: string;
  /** Object name resolved by the frontend; the backend returns only type:id. Mock mode supplies it, real mode resolves it through domain services. */
  objName: string;
  objSub?: string;
  objType: string;
  /** Compatibility summary returned by the API; do not treat it as the final decision. */
  operations: string[];
  bundle?: "full_business_access";
  /** Absent only while reading legacy fixtures or old deployments. */
  deniedOperations?: string[];
  effectiveDecisions?: EffectiveDecision[];
  grants?: GrantRecord[];
};

/** An authorizable object used by the overview page's new-grant picker. Real mode loads it from domain services. */
export type AuthorizableObject = {
  id: string;
  name: string;
  sub?: string;
  type: string;
};

type ObjectGrantTargetInput = {
  accessorId: string;
  objId: string;
  objName: string;
  objSub?: string;
  objType: string;
};

/** Community has one intentionally coarse bundle and no operation/effect controls. */
export type CommunityBundleGrantInput = ObjectGrantTargetInput & {
  bundle: "full_business_access";
};

/** Professional+ creates one independent allow/deny source record per requested operation. */
export type FineGrainedGrantInput = ObjectGrantTargetInput & {
  /** Omitted only for legacy callers; new UI always sends an explicit effect. */
  effect?: GrantEffect;
  operations: string[];
};

export type ObjectGrantInput = CommunityBundleGrantInput | FineGrainedGrantInput;

export type AuthzSummary = {
  /** Deduplicated number of grantee users. */
  grantees: number;
  grants: number;
  objects: number;
};

/** GET /object-grants query parameters for the real backend. */
export type ObjectGrantQuery = {
  accessorId?: string;
  resourceType?: string;
  resourceId?: string;
  search?: string;
  offset?: number;
  limit?: number;
  includeSummary?: boolean;
};

export type ObjectGrantListResult = {
  grants: ObjectGrant[];
  total: number;
  summary?: AuthzSummary;
};

export type EnterpriseGrantActivationState =
  | "activated"
  | "expired"
  | "downgraded_inactive"
  | "deleted"
  | "dormant"
  | "experimental"
  | "invalid";

export type EnterpriseObjectGrant = {
  activationState: EnterpriseGrantActivationState;
  accessorId: string;
  classification: string;
  effect: GrantEffect;
  expiresAt?: string;
  grantId: string;
  inactiveReason?: string;
  operation: string;
  resourceId: string;
  resourceType: string;
  ruleId: string;
  runtimeEligible: boolean;
  subjectType: "user" | "role" | "department" | "unknown";
};
