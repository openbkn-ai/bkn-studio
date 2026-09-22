/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  mockActionTypeDetailExtras,
  mockActionTypeExecutionConfigs,
  mockObjectTypeDataProperties,
  mockRelationTypeMappings,
  mockRelationTypeResourceMappings,
  removeMockActionTypeDetailExtras,
  removeMockActionTypeExecutionConfig,
  removeMockObjectTypeProperties,
  removeMockRelationTypeMappings,
  removeMockRelationTypeResourceMappings,
} from "./state";

describe("mock state store keys", () => {
  it("does not apply reserved keys to mutable stores", () => {
    const objectProperties = mockObjectTypeDataProperties["kn-domain-risk"];
    const relationMappings = mockRelationTypeMappings["kn-domain-risk"];
    const resourceMappings = mockRelationTypeResourceMappings["kn-domain-supply"];
    const executionConfigs = mockActionTypeExecutionConfigs["kn-domain-risk"];
    const extras = mockActionTypeDetailExtras["kn-domain-risk"];

    removeMockObjectTypeProperties("kn-domain-risk", "__proto__");
    removeMockRelationTypeMappings("kn-domain-risk", "constructor");
    removeMockRelationTypeResourceMappings("kn-domain-supply", "prototype");
    removeMockActionTypeExecutionConfig("kn-domain-risk", "__proto__");
    removeMockActionTypeDetailExtras("kn-domain-risk", "constructor");

    expect(mockObjectTypeDataProperties["kn-domain-risk"]).toBe(objectProperties);
    expect(mockRelationTypeMappings["kn-domain-risk"]).toBe(relationMappings);
    expect(mockRelationTypeResourceMappings["kn-domain-supply"]).toBe(resourceMappings);
    expect(mockActionTypeExecutionConfigs["kn-domain-risk"]).toBe(executionConfigs);
    expect(mockActionTypeDetailExtras["kn-domain-risk"]).toBe(extras);
    expect(Object.prototype).not.toHaveProperty("polluted");
  });
});
