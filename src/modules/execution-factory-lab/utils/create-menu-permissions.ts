/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { executionFactoryLabPermissions } from "@/modules/execution-factory-lab/permissions";

export function createMenuPermissionForKey(key: string): string | string[] {
  switch (key) {
    case "http":
    case "import":
      return executionFactoryLabPermissions.capabilityCreate;
    case "mcp":
      return executionFactoryLabPermissions.mcpCreate;
    case "skill":
      return executionFactoryLabPermissions.skillCreate;
    case "function":
      return executionFactoryLabPermissions.functionCreate;
    case "impex":
      return executionFactoryLabPermissions.impexImport;
    default:
      return executionFactoryLabPermissions.capabilityCreate;
  }
}

export function editPermissionForKind(kind: string): string {
  if (kind === "mcp") {
    return executionFactoryLabPermissions.capabilityEdit;
  }
  if (kind === "skill") {
    return executionFactoryLabPermissions.capabilityEdit;
  }
  if (kind === "function") {
    return executionFactoryLabPermissions.capabilityEdit;
  }
  return executionFactoryLabPermissions.capabilityEdit;
}
