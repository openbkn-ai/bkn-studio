/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { RuntimeUser } from "@/framework/runtime/types";
import { defaultDevPermissions } from "@/framework/runtime/module-manifests";
import { getMockUserRole, getMockViewerUser } from "@/framework/runtime/mock-user";

export const defaultDevRuntimeUser: RuntimeUser = {
  id: "266c6a42-6131-4d62-8f39-853e7093701c",
  isAdmin: true,
  isSuperAdmin: true,
  name: "Local Admin",
  permissions: defaultDevPermissions,
  roles: ["admin"],
};

export function getDevRuntimeUser(): RuntimeUser {
  if (getMockUserRole() === "viewer") {
    return getMockViewerUser();
  }

  return {
    ...defaultDevRuntimeUser,
    permissions: [...defaultDevRuntimeUser.permissions],
    roles: [...defaultDevRuntimeUser.roles],
  };
}
