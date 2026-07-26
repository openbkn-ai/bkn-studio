/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  buildToolLogicParameterSettings,
  isToolLogicBindingComplete,
  readLogicAttributeToolBinding,
} from "./constants";

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
