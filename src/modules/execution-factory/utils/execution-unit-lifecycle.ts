/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Lifecycle actions exposed on execution-unit cards.
 *
 * Backend status machine (operator-integration):
 * - unpublish / editing / offline → published
 * - published → offline (NOT unpublish)
 *
 * The UI collapses `offline` and `unpublish` into a single 未发布 label, so the
 * take-down action reads as 取消发布 while still submitting `offline`.
 */
export type ExecutionUnitLifecycleAction = "publish" | "offline";

export type ExecutionUnitLifecycleStatus = "published" | "offline";

export function getExecutionUnitLifecycleActions(
  status: string | undefined,
): ExecutionUnitLifecycleAction[] {
  if (status === "unpublish" || status === "editing" || status === "offline") {
    return ["publish"];
  }

  if (status === "published") {
    return ["offline"];
  }

  return [];
}

/**
 * Statuses to query for one filter选项.
 *
 * 「未发布」covers both `unpublish` (never published) and `offline` (taken down),
 * but the list API only takes a single status, so that option fans out into two
 * requests. Anything else queries as-is.
 */
export function resolveListStatusQueries(status: string | undefined): (string | undefined)[] {
  if (status === "unpublish") {
    return ["unpublish", "offline"];
  }

  return [status || undefined];
}

/**
 * Maps a UI lifecycle action to the API status payload.
 * Published take-down must submit `offline`, never `unpublish`.
 */
export function resolveLifecycleActionStatus(
  action: ExecutionUnitLifecycleAction,
): ExecutionUnitLifecycleStatus {
  return action === "publish" ? "published" : "offline";
}
