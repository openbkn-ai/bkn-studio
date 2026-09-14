/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { executionFactoryLabPermissions } from "@/modules/execution-factory-lab/permissions";
import { editPermissionForKind } from "@/modules/execution-factory-lab/utils/create-menu-permissions";

describe("editPermissionForKind", () => {
  it("uses the resource-specific modify permission for MCP and Skill", () => {
    expect(editPermissionForKind("mcp")).toBe(executionFactoryLabPermissions.mcpEdit);
    expect(editPermissionForKind("skill")).toBe(executionFactoryLabPermissions.skillEdit);
  });

  it("keeps HTTP and function edits on the operator permission", () => {
    expect(editPermissionForKind("http")).toBe(executionFactoryLabPermissions.capabilityEdit);
    expect(editPermissionForKind("function")).toBe(executionFactoryLabPermissions.capabilityEdit);
  });
});
