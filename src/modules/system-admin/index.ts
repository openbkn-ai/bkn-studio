/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export { systemAdminModuleManifest } from "@/modules/system-admin/module.manifest";
export type {
  RoleManagementSceneProps,
  UserManagementSceneProps,
} from "@/modules/system-admin/contracts/scenes";
export { UserManagementScene } from "@/modules/system-admin/scenes/UserManagementScene";
export { RoleManagementScene } from "@/modules/system-admin/scenes/RoleManagementScene";
export { AuditLogScene } from "@/modules/system-admin/scenes/AuditLogScene";
export type * from "@/modules/system-admin/types/admin";
