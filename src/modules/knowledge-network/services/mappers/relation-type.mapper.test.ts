/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { mapRelationType } from "@/modules/knowledge-network/services/mappers";
import { toBackendRelationTypeCreateEntry } from "./relation-type.mapper";

describe("relation type mapper", () => {
  it("writes resource mappings as the indirect relation type", () => {
    const payload = toBackendRelationTypeCreateEntry({
      color: "#1677ff",
      description: "",
      mappingMode: "resource",
      mappingRules: {
        backingDataSourceId: "resource-1",
        resourceMappings: [],
        propertyMappings: [],
        sourceObjectTypeId: "order",
        targetObjectTypeId: "item",
      },
      name: "Order item",
      sourceObjectTypeId: "order",
      tags: [],
      targetObjectTypeId: "item",
    });

    expect(payload.type).toBe("indirect");
    expect(payload.mapping_mode).toBe("indirect");
  });

  it("reads indirect relation types as resource mappings", () => {
    expect(mapRelationType({ id: "indirect-1", name: "Indirect", type: "indirect" }).mappingMode).toBe("resource");
  });
});
