/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export { accountRouteContribution } from "@/modules/account/routes";
export { AccountScene } from "@/modules/account/scenes/AccountScene";

export { PermissionRequestsPanel } from "./components/PermissionRequestsPanel";
export { listPermissionRequests } from "./services/permission-requests.service";
export type { PermissionRequest } from "./services/permission-requests.service";

export {
  getPermissionRequestTodoSummary,
  notifyPermissionRequestTodoSummaryChanged,
} from "./services/permission-requests.service";
