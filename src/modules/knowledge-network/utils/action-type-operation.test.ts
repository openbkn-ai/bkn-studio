/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";
import {
  getActionTypeOperationKind,
  actionTypeSpecificOperationLabelKey,
  mapActionOperationConfig,
  toBackendActionOperationConfig,
  inferActionRelationBindings,
  validateActionRelationBindings,
  canBindActionRelationIdentity,
  getActionRelationAnchor,
} from "./action-type-operation";
import type { ActionRelationIdentity } from "./action-type-operation";
import { normalizeActionTypeExecutionConfig } from "./action-type-execution";
import {
  toBackendActionTypeCreateEntry,
  mapActionTypeDetail,
} from "../services/mappers/action-type.mapper";
import type { ActionTypeExecutionParameter } from "../types/action-type";

describe("action operation compatibility", () => {
  it("labels object, relationship, and independent tool actions by their actual operation", () => {
    expect(
      actionTypeSpecificOperationLabelKey({ actionKind: "create", objectTypeId: "orders" }),
    ).toBe("knowledgeNetwork.actionObjectCreateInstance");
    expect(
      actionTypeSpecificOperationLabelKey({
        actionKind: "create",
        objectTypeId: "orders",
        operationConfig: {
          type: "relation",
          relationTypeId: "order_supplier",
          relationOperation: "delete",
        },
      }),
    ).toBe("knowledgeNetwork.actionRelationDelete");
    expect(actionTypeSpecificOperationLabelKey({ actionKind: "notify", objectTypeId: "" })).toBe(
      "knowledgeNetwork.actionOperationExecuteTool",
    );
  });
  it("infers the selected object's role for both directions and leaves self relations explicit", () => {
    const relation = { sourceObjectTypeId: "orders", targetObjectTypeId: "suppliers" };
    expect(getActionRelationAnchor(relation, "orders")).toBe("source");
    expect(getActionRelationAnchor(relation, "suppliers")).toBe("target");
    expect(getActionRelationAnchor(relation, "projects")).toBeUndefined();
    expect(
      getActionRelationAnchor(
        { sourceObjectTypeId: "people", targetObjectTypeId: "people" },
        "people",
      ),
    ).toBeUndefined();
  });

  it("preserves anchor direction and other endpoint conditions in the contract", () => {
    const configuration = {
      type: "relation" as const,
      relationTypeId: "order_supplier",
      relationOperation: "delete" as const,
      anchorRole: "target" as const,
      otherObjectCondition: {
        objectTypeId: "orders",
        operation: "and" as const,
        valueFrom: "const" as const,
        subConditions: [
          {
            objectTypeId: "orders",
            field: "status",
            operation: "==" as const,
            valueFrom: "const" as const,
            value: "open",
          },
        ],
      },
    };
    const backend = toBackendActionOperationConfig(configuration);
    expect(backend).toMatchObject({
      anchor_role: "target",
      other_object_condition: {
        object_type_id: "orders",
        sub_conditions: [{ field: "status", value: "open" }],
      },
    });
    expect(mapActionOperationConfig(backend)).toEqual(configuration);
  });
  const source: ActionRelationIdentity = {
    objectTypeId: "orders",
    objectTypeName: "Order",
    properties: [{ name: "order_id", label: "Order ID", type: "string" }],
  };
  const target: ActionRelationIdentity = {
    objectTypeId: "suppliers",
    objectTypeName: "Supplier",
    properties: [{ name: "supplier_id", label: "Supplier ID", type: "string" }],
  };
  const inputs: ActionTypeExecutionParameter[] = [
    { name: "order_id", type: "string", valueFrom: "input" },
    { name: "supplier_id", type: "string", valueFrom: "input" },
  ];

  it("defaults exact, unambiguous primary key matches without copying IDs into literals", () => {
    const parameters = inferActionRelationBindings(inputs, {
      sourceIdentity: source,
      targetIdentity: target,
    });
    expect(parameters).toEqual([
      expect.objectContaining({ name: "order_id", valueFrom: "source_identity", value: undefined }),
      expect.objectContaining({
        name: "supplier_id",
        valueFrom: "target_identity",
        value: undefined,
      }),
    ]);
    expect(validateActionRelationBindings(parameters)).toBeNull();
  });

  it("does not guess when endpoint identities have the same name or parameters are already configured", () => {
    const same = { ...target, properties: source.properties };
    expect(
      inferActionRelationBindings(inputs, { sourceIdentity: source, targetIdentity: same }),
    ).toBe(inputs);
    const configured: ActionTypeExecutionParameter[] = [
      { name: "order_id", type: "string", valueFrom: "const", value: "fixed" },
    ];
    expect(inferActionRelationBindings(configured, { sourceIdentity: source })).toBe(configured);
    const duplicateInputs = [...inputs, inputs[0]];
    expect(inferActionRelationBindings(duplicateInputs, { sourceIdentity: source })).toBe(
      duplicateInputs,
    );
    expect(validateActionRelationBindings(inputs)).toBe(
      "knowledgeNetwork.actionRelationBindingsRequired",
    );
  });

  it("does not silently choose part of a composite identity or bind incompatible types", () => {
    expect(
      canBindActionRelationIdentity(
        { ...source, properties: [...source.properties, ...target.properties] },
        "string",
      ),
    ).toBe(false);
    expect(canBindActionRelationIdentity(source, "number")).toBe(false);
    expect(canBindActionRelationIdentity({ ...source, properties: [] }, "string")).toBe(false);
    expect(canBindActionRelationIdentity(source, "string")).toBe(true);
  });

  it("round-trips identity sources through normalization and DTO mapping without duplicate endpoint fields", () => {
    const execution = normalizeActionTypeExecutionConfig({
      sourceType: "tool",
      sourceName: "Link supplier",
      parameters: inferActionRelationBindings(inputs, {
        sourceIdentity: source,
        targetIdentity: target,
      }),
    });
    const configuration = {
      type: "relation" as const,
      relationTypeId: "order_supplier",
      relationOperation: "create" as const,
    };
    const payload = toBackendActionTypeCreateEntry({
      operationConfig: configuration,
      actionKind: "create",
      color: "#1677ff",
      description: "",
      name: "Link supplier",
      objectTypeId: "",
      tags: [],
      executionConfig: execution,
    });
    expect(payload.parameters).toEqual([
      { name: "order_id", value_from: "source_identity", value: undefined },
      { name: "supplier_id", value_from: "target_identity", value: undefined },
    ]);
    const detail = mapActionTypeDetail({ ...payload, id: "a-1" });
    expect(detail.executionConfig.parameters.map((parameter) => parameter.valueFrom)).toEqual([
      "source_identity",
      "target_identity",
    ]);
    expect(detail.operationConfig).toEqual(configuration);
  });
  it("distinguishes legacy actions without treating an optional object context as an object write", () => {
    expect(getActionTypeOperationKind({ objectTypeId: "order" })).toBe("object");
    expect(getActionTypeOperationKind({ objectTypeId: "" })).toBe("tool");
    expect(
      getActionTypeOperationKind({ objectTypeId: "order", operationConfig: { type: "tool" } }),
    ).toBe("tool");
  });

  it("round-trips relationship target and operation in the proposed contract", () => {
    const configuration = {
      type: "relation" as const,
      relationTypeId: "order_supplier",
      relationOperation: "delete" as const,
    };
    const backend = toBackendActionOperationConfig(configuration);
    expect(backend).toEqual({
      type: "relation",
      relation_type_id: "order_supplier",
      relation_operation: "delete",
    });
    expect(mapActionOperationConfig(backend)).toEqual(configuration);
  });
});
