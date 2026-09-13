/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ToolStatus } from "@/modules/execution-factory/types/tool";

/**
 * OK-button labels for status-change confirmations.
 *
 * These dialogs call a status API and never persist form content, so their OK button must not
 * read Save. It names the action instead, reusing the label of the button or menu item that
 * opened the dialog.
 */

export type StatusChangeOkTextKey =
  | "executionFactory.publish"
  | "executionFactory.offline"
  | "executionFactory.statusChangeConfirmOk";

export type ToolStatusOkTextKey = "executionFactory.enable" | "executionFactory.disable";

/**
 * Label for publishing or unpublishing an operator, toolbox, MCP, or SKILL. A target status that
 * maps to no single action falls back to a generic Confirm.
 */
export function resolveStatusChangeOkTextKey(status: string): StatusChangeOkTextKey {
  if (status === "published") {
    return "executionFactory.publish";
  }

  if (status === "offline") {
    return "executionFactory.offline";
  }

  return "executionFactory.statusChangeConfirmOk";
}

/** Label for enabling or disabling tools and functions, one at a time or in bulk. */
export function resolveToolStatusOkTextKey(status: ToolStatus): ToolStatusOkTextKey {
  return status === "enabled" ? "executionFactory.enable" : "executionFactory.disable";
}
