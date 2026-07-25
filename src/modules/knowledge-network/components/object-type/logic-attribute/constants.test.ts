/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { buildToolLogicParameterSettings, removeParameterById } from "./constants";

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
  it("removes a top-level parameter by id", () => {
    expect(
      removeParameterById(
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
      removeParameterById(
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
