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
  id: "local-admin",
  name: "Local Admin",
  permissions: defaultDevPermissions,
  roles: ["admin"],
};
