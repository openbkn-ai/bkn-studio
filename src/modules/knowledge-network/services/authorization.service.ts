/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";

/**
 * Owner-side authorization for a single knowledge network.
 *
 * These call bkn-safe's self-service surface (`/safe/v1/me/...`), NOT the admin one
 * (`/safe/v1/admin/object-grants`). The admin group sits behind a platform-administrator gate that a
 * network builder never passes, so the builder who created a network could not share it. The
 * self-service endpoints accept either an administrator or the holder of `authorize` on the very
 * object named in the request, which is exactly the row bkn-backend writes to the creator.
 *
 * Every call is scoped to one network. There is no "list every grant" here on purpose — that stays
 * with the administrator page under /system/authorizations.
 */

const RESOURCE_TYPE = "knowledge_network";

/** One accessor's operations on this network, with the account resolved server-side. */
export type KnowledgeNetworkGrant = {
  accessorId: string;
  /** Login account. Absent when the subject is a role or a since-deleted user. */
  account?: string;
  name?: string;
  operations: string[];
};

/** A candidate grantee from the owner-scoped picker. */
export type GrantableUser = {
  account: string;
  id: string;
  name: string;
};

type BackendGrantsResponse = {
  entries?: {
    accessor_account?: string;
    accessor_id?: string;
    accessor_name?: string;
    operations?: string[];
  }[];
};

type BackendUsersResponse = {
  users?: { account?: string; id?: string; name?: string }[];
};

/**
 * Operations an owner may hand out on a network.
 *
 * `authorize` is deliberately absent: bkn-safe rejects it from a non-administrator, because a
 * delegate that could pass `authorize` on would mint further delegates without an administrator
 * ever acting. `create` is absent because it is type-scoped — there is no such thing as "create"
 * on one existing network.
 */
export const KNOWLEDGE_NETWORK_GRANTABLE_OPERATIONS = [
  "view_detail",
  "query_data",
  "modify",
  "delete",
  "task_manage",
] as const;

/** Reads who currently holds what on this network. */
export async function listKnowledgeNetworkGrants(
  networkId: string,
): Promise<KnowledgeNetworkGrant[]> {
  const response = await http.get<BackendGrantsResponse>("/safe/v1/me/object-grants", {
    params: { resource_id: networkId, resource_type: RESOURCE_TYPE },
  });
  return (response.data.entries ?? [])
    .filter((entry) => entry.accessor_id)
    .map((entry) => ({
      accessorId: entry.accessor_id ?? "",
      account: entry.accessor_account,
      name: entry.accessor_name,
      operations: entry.operations ?? [],
    }));
}

/**
 * Replaces one accessor's operation set on this network.
 *
 * Replace, not merge: passing a smaller set removes the operations left out. Callers must therefore
 * submit the accessor's full intended set, which is why the drawer loads the current grants first.
 */
export async function setKnowledgeNetworkGrant(
  networkId: string,
  accessorId: string,
  operations: string[],
): Promise<void> {
  await http.post("/safe/v1/me/object-grants", {
    accessor_id: accessorId,
    operations,
    resource: { id: networkId, type: RESOURCE_TYPE },
  });
}

/** Removes one accessor's access to this network entirely. Idempotent server-side. */
export async function removeKnowledgeNetworkGrant(
  networkId: string,
  accessorId: string,
): Promise<void> {
  await http.delete("/safe/v1/me/object-grants", {
    data: { accessor_id: accessorId, resource: { id: networkId, type: RESOURCE_TYPE } },
  });
}

/**
 * Searches accounts this network can be shared with.
 *
 * Scoped to the network rather than to the platform: the user directory is admin-only, and this
 * lookup is opened only to callers who may already authorize the network they name.
 */
export async function searchKnowledgeNetworkGrantableUsers(
  networkId: string,
  search: string,
): Promise<GrantableUser[]> {
  const response = await http.get<BackendUsersResponse>("/safe/v1/me/grantable-users", {
    params: { resource_id: networkId, resource_type: RESOURCE_TYPE, search: search.trim() },
  });
  return (response.data.users ?? [])
    .filter((user) => user.id)
    .map((user) => ({
      account: user.account ?? "",
      id: user.id ?? "",
      name: user.name ?? user.account ?? "",
    }));
}
