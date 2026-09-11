/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  AUTHZ_OBJECT_PICKER_TYPES,
  AUTHZ_OBJECT_TYPES,
  COMMUNITY_OBJECT_GRANT_TYPES,
  FINE_GRAINED_OBJECT_FILTER_TYPES,
  isAuthzObjectPickerType,
  isAuthzObjectType,
} from "./authz-catalog";

describe("object authorization types", () => {
  it("keeps stored grant types filterable while restricting the new-grant picker", () => {
    expect(AUTHZ_OBJECT_TYPES).toContain("small_model");
    expect(AUTHZ_OBJECT_TYPES).toContain("large_model");
    expect(isAuthzObjectType("small_model")).toBe(true);
    expect(isAuthzObjectType("concept_group")).toBe(true);

    for (const type of ["small_model", "large_model", "concept_group", "object_type", "relation_type", "action_type", "metric", "risk_type"]) {
      expect(AUTHZ_OBJECT_PICKER_TYPES).not.toContain(type);
      expect(isAuthzObjectPickerType(type)).toBe(false);
    }
  });

  it("exposes edition-aware filter catalogues without retired model resources", () => {
    expect(COMMUNITY_OBJECT_GRANT_TYPES).toContain("catalog");
    expect(COMMUNITY_OBJECT_GRANT_TYPES).toContain("knowledge_network");
    expect(COMMUNITY_OBJECT_GRANT_TYPES).not.toContain("resource");
    expect(COMMUNITY_OBJECT_GRANT_TYPES).not.toContain("object_type");
    expect(FINE_GRAINED_OBJECT_FILTER_TYPES).toContain("resource");
    expect(FINE_GRAINED_OBJECT_FILTER_TYPES).toContain("object_type");
    expect(FINE_GRAINED_OBJECT_FILTER_TYPES).not.toContain("small_model");
    expect(FINE_GRAINED_OBJECT_FILTER_TYPES).not.toContain("large_model");
  });
});
