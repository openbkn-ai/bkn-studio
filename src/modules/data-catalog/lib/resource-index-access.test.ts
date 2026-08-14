/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  canManageResourceBuildTasks,
  canViewResourceIndexTasks,
  isResourceIndexReadOnly,
} from "@/modules/data-catalog/lib/resource-index-access";
import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";
import type { CatalogRecord } from "@/shared/catalog";

const catalog = (internal: boolean) => ({ internal }) as CatalogRecord;
const resource = (category: CatalogResource["category"]) => ({ category }) as CatalogResource;

describe("resource index access", () => {
  it("keeps internal catalog resources read-only", () => {
    expect(isResourceIndexReadOnly(catalog(true))).toBe(true);
    expect(isResourceIndexReadOnly(catalog(false))).toBe(false);
  });

  it("does not allow dataset resources to create build tasks", () => {
    expect(canManageResourceBuildTasks(resource("dataset"), catalog(false))).toBe(false);
    expect(canViewResourceIndexTasks(resource("dataset"))).toBe(false);
  });

  it("allows future non-dataset resource categories to manage build tasks", () => {
    expect(canManageResourceBuildTasks(resource("logicview"), catalog(false))).toBe(true);
    expect(canManageResourceBuildTasks(resource("table"), catalog(true))).toBe(false);
    expect(canViewResourceIndexTasks(resource("logicview"))).toBe(true);
  });
});
