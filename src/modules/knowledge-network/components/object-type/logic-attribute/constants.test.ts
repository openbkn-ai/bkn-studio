/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  LOGIC_ATTRIBUTE_TYPE_OPTIONS,
  LOGIC_RESULT_PATH_PLACEHOLDER,
  buildToolLogicParameterSettings,
  isToolLogicBindingComplete,
  removeParameterById,
  readLogicAttributeToolBinding,
} from "./constants";

describe("LOGIC_ATTRIBUTE_TYPE_OPTIONS", () => {
  it("only exposes tool bindings while instance metrics are unavailable", () => {
    expect(LOGIC_ATTRIBUTE_TYPE_OPTIONS).toEqual([
      { labelKey: "objectTypeLogicAttributeTypeTool", value: "tool" },
    ]);
  });
});

describe("LOGIC_RESULT_PATH_PLACEHOLDER", () => {
  it("matches the execution factory function response envelope", () => {
    expect(LOGIC_RESULT_PATH_PLACEHOLDER).toBe("$.result");
  });
});

describe("buildToolLogicParameterSettings", () => {
  it("merges saved tool parameter mappings into the input schema", () => {
    let index = 0;

    const result = buildToolLogicParameterSettings(
      [
        {
          children: [
            {
              key: "body.city",
              name: "city",
              source: "Body",
              type: "string",
            },
          ],
          key: "body",
          name: "body",
          source: "Body",
          type: "object",
        },
      ],
      [
        {
          id: "saved-city",
          name: "body.city",
          source: "Body",
          type: "string",
          value: "customer_city",
          valueFrom: "property",
        },
      ],
      () => `generated-${++index}`,
    );

    expect(result).toEqual([
      {
        children: [
          {
            children: undefined,
            description: undefined,
            id: "saved-city",
            name: "body.city",
            source: "Body",
            type: "string",
            value: "customer_city",
            valueFrom: "property",
          },
        ],
        description: undefined,
        id: "generated-1",
        name: "body",
        source: "Body",
        type: "object",
        value: undefined,
        valueFrom: "input",
      },
    ]);
  });

  it("keeps saved parameters when the tool schema cannot be resolved", () => {
    const result = buildToolLogicParameterSettings(
      [],
      [
        {
          id: "",
          name: "query",
          source: "Body",
          type: "string",
          value: "openbkn",
          valueFrom: "const",
        },
      ],
      () => "generated-id",
    );

    expect(result).toEqual([
      {
        id: "generated-id",
        name: "query",
        source: "Body",
        type: "string",
        value: "openbkn",
        valueFrom: "const",
      },
    ]);
  });
});

describe("removeParameterById", () => {
  type TestNode = { children?: TestNode[]; id: string; name: string };

  it("removes a top-level parameter by id", () => {
    expect(
      removeParameterById<TestNode>(
        [
          { id: "a", name: "count" },
          { id: "b", name: "param" },
        ],
        "a",
      ),
    ).toEqual([{ id: "b", name: "param" }]);
  });

  it("removes a nested parameter by id", () => {
    expect(
      removeParameterById<TestNode>(
        [
          {
            children: [
              { id: "child", name: "body.city" },
              { id: "keep", name: "body.name" },
            ],
            id: "body",
            name: "body",
          },
        ],
        "child",
      ),
    ).toEqual([
      {
        children: [{ id: "keep", name: "body.name" }],
        id: "body",
        name: "body",
      },
    ]);
  });
});

describe("readLogicAttributeToolBinding", () => {
  it("treats antd default getFieldsValue() shape (no boxId/toolId) as incomplete", () => {
    // Reproduces #261: tool name may be visible while registered-only values omit binding ids.
    const registeredOnly = {
      displayName: "Risk Score",
      name: "risk_score",
      type: "tool",
    };

    expect(isToolLogicBindingComplete(readLogicAttributeToolBinding(registeredOnly))).toBe(false);
  });

  it("accepts complete tool binding when boxId and toolId are present", () => {
    const allValues = {
      boxId: "box-1",
      displayName: "Risk Score",
      name: "risk_score",
      resourceName: "Demo Tool",
      toolId: "tool-1",
      type: "tool",
    };

    expect(readLogicAttributeToolBinding(allValues)).toEqual({
      boxId: "box-1",
      resourceName: "Demo Tool",
      toolId: "tool-1",
    });
    expect(isToolLogicBindingComplete(readLogicAttributeToolBinding(allValues))).toBe(true);
  });
});
