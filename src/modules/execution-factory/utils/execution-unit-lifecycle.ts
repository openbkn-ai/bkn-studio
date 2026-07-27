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
 * i18n key for a lifecycle action label.
 *
 * Action wording follows the target status: `offline` reads as 下线 → 已下线.
 * Re-publishing something already taken down reads as 重新发布 so it pairs with
 * the 已下线 tag instead of looking like a first-time publish.
 */
export function getLifecycleActionLabelKey(
  action: ExecutionUnitLifecycleAction,
  status: string | undefined,
): string {
  if (action === "offline") {
    return "executionFactory.offline";
  }

  return status === "offline"
    ? "executionFactory.cardMenu.republish"
    : "executionFactory.publish";
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
