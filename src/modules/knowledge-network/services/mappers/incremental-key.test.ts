/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  buildBackendObjectTypePayload,
  mapObjectTypeDetail,
} from "@/modules/knowledge-network/services/mappers";
import type {
  KnowledgeNetworkObjectTypeMutationPayload,
  ObjectTypeDataProperty,
} from "@/modules/knowledge-network/types/knowledge-network";

const property = (name: string, type: string): ObjectTypeDataProperty => ({
  displayKey: false,
  displayName: name,
  incrementalKey: false,
  name,
  primaryKey: false,
  type,
});

const save = (
  overrides: Partial<KnowledgeNetworkObjectTypeMutationPayload>,
): KnowledgeNetworkObjectTypeMutationPayload => ({
  color: "#1d4ed8",
  conceptGroupIds: [],
  dataProperties: [property("id", "string"), property("updated_at", "datetime")],
  description: "",
  name: "检验申请",
  tags: [],
  ...overrides,
});

describe("the incremental key on an object type save", () => {
  // A save replaces the whole object type: without the key, the backend stores none.
  it("sends the stored key back, though the form does not edit it", () => {
    expect(
      buildBackendObjectTypePayload(save({ incrementalKey: "updated_at" }), [], "lab_order"),
    ).toMatchObject({ incremental_key: "updated_at" });
  });

  it("leaves the key out when the object type has none", () => {
    expect(buildBackendObjectTypePayload(save({ incrementalKey: "" }), [])).not.toHaveProperty(
      "incremental_key",
    );
    expect(buildBackendObjectTypePayload(save({}), [])).not.toHaveProperty("incremental_key");
  });

  it("leaves out a key the backend would refuse: its property is gone, or of another type", () => {
    expect(
      buildBackendObjectTypePayload(save({ incrementalKey: "deleted_at" }), []),
    ).not.toHaveProperty("incremental_key");
    expect(
      buildBackendObjectTypePayload(
        save({
          dataProperties: [property("updated_at", "string")],
          incrementalKey: "updated_at",
        }),
        [],
      ),
    ).not.toHaveProperty("incremental_key");
  });

  // An eval repair reads it to leave the key's property type alone.
  it("marks the property the key names when it reads an object type", () => {
    const detail = mapObjectTypeDetail({
      data_properties: [
        { name: "id", type: "string" },
        { name: "updated_at", type: "datetime" },
      ],
      id: "lab_order",
      incremental_key: "updated_at",
      name: "检验申请",
    });
    expect(detail.dataProperties.map((item) => [item.name, item.incrementalKey])).toEqual([
      ["id", false],
      ["updated_at", true],
    ]);
  });
});
