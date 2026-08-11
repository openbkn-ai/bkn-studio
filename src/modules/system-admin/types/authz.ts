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
// Backend contract highlights (frontend-object-grants-integration.md):
//   - Grantees support users only; departments were removed because Casbin has no user-to-department rule.
//   - A grant is {accessor_id, resource:{type,id}, operations[]}, without its own ID or grantor timestamp.
//   - The unique key is accessor_id + resource.type + resource.id; POST replaces the complete set.
//   - resource.id must be a concrete instance; `*` is unsupported, and type-wide grants use the role page.
//   - bkn-safe does not store resource names; the frontend resolves them through domain services into objName.

/** One object-level grant that gives a user selected operations on an object. */
export type ObjectGrant = {
  /** Grantee user ID (backend accessor_id). */
  accessorId: string;
  objId: string;
  /** Object name resolved by the frontend; the backend returns only type:id. Mock mode supplies it, real mode resolves it through domain services. */
  objName: string;
  objSub?: string;
  objType: string;
  /** Derived from operationsForType(objType); object-grant UI hides type-level create. */
  operations: string[];
};

/** An authorizable object used by the overview page's new-grant picker. Real mode loads it from domain services. */
export type AuthorizableObject = {
  id: string;
  name: string;
  sub?: string;
  type: string;
};

/** Creates or updates a grant, unique by user and object and replaced as a complete set. Empty operations revoke it. */
export type ObjectGrantInput = {
  accessorId: string;
  objId: string;
  objName: string;
  objSub?: string;
  objType: string;
  operations: string[];
};

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
