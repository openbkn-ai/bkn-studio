/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { RuntimeUser } from "@/framework/runtime/types";
import { defaultDevPermissions } from "@/framework/runtime/module-manifests";

export const defaultDevRuntimeUser: RuntimeUser = {
  businessDomainId: "bd_public",
  id: "266c6a42-6131-4d62-8f39-853e7093701c",
  isAdmin: true,
  name: "Local Admin",
  permissions: defaultDevPermissions,
  roles: ["admin"],
};
