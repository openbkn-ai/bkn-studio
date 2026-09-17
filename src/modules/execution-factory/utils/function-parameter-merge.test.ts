/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { isSameParameterList, mergeInferredParameters } from "./function-parameter-merge";

describe("mergeInferredParameters", () => {
  it("keeps the description of a parameter that is still declared", () => {
    const merged = mergeInferredParameters(
      [
        { name: "price", type: "number", description: "销售价", required: true },
        { name: "cost_price", type: "number", description: "成本价", required: true },
      ],
      [
        { name: "price", type: "number", required: true },
        { name: "cost_price", type: "number", required: true },
      ],
    );

    expect(merged).toEqual([
      { name: "price", type: "number", description: "销售价", required: true },
      { name: "cost_price", type: "number", description: "成本价", required: true },
    ]);
  });

  it("follows inference for removed, added and reordered parameters and for required", () => {
    const merged = mergeInferredParameters(
      [
        { name: "a", type: "string", description: "A", required: true },
        { name: "gone", type: "string", description: "removed" },
      ],
      [
        { name: "added", type: "integer", required: true },
        { name: "a", type: "string", required: false },
      ],
    );

    expect(merged).toEqual([
      { name: "added", type: "integer", required: true },
      { name: "a", type: "string", description: "A", required: false },
    ]);
  });

  it("fills only empty descriptions from the inferred docstring", () => {
    const merged = mergeInferredParameters(
      [
        { name: "kept", type: "string", description: "hand written" },
        { name: "blank", type: "string", description: "  " },
      ],
      [
        { name: "kept", type: "string", description: "from docstring" },
        { name: "blank", type: "string", description: "from docstring" },
        { name: "fresh", type: "string", description: "from docstring" },
      ],
    );

    expect(merged.map((parameter) => parameter.description)).toEqual([
      "hand written",
      "from docstring",
      "from docstring",
    ]);
  });

  it("merges nested sub_parameters level by level, pairing unnamed array items by position", () => {
    const merged = mergeInferredParameters(
      [
        {
          name: "demands",
          type: "array",
          description: "需求列表",
          sub_parameters: [
            {
              type: "object",
              description: "一条需求",
              sub_parameters: [
                { name: "product", type: "string", description: "BOM 根物料" },
                { name: "qty", type: "integer", description: "数量" },
              ],
            },
          ],
        },
      ],
      [
        {
          name: "demands",
          type: "array",
          sub_parameters: [
            {
              type: "object",
              sub_parameters: [
                { name: "product", type: "string" },
                { name: "due", type: "string" },
              ],
            },
          ],
        },
      ],
    );

    expect(merged).toEqual([
      {
        name: "demands",
        type: "array",
        description: "需求列表",
        sub_parameters: [
          {
            type: "object",
            description: "一条需求",
            sub_parameters: [
              { name: "product", type: "string", description: "BOM 根物料" },
              { name: "due", type: "string" },
            ],
          },
        ],
      },
    ]);
  });

  it("keeps only the top-level description when the type changes", () => {
    const merged = mergeInferredParameters(
      [
        {
          name: "filter",
          type: "object",
          description: "过滤条件",
          sub_parameters: [{ name: "field", type: "string", description: "字段" }],
        },
      ],
      [
        {
          name: "filter",
          type: "array",
          sub_parameters: [{ name: "field", type: "string" }],
        },
      ],
    );

    expect(merged).toEqual([
      {
        name: "filter",
        type: "array",
        description: "过滤条件",
        sub_parameters: [{ name: "field", type: "string" }],
      },
    ]);
  });

  it("returns an empty list for a zero-argument function", () => {
    expect(mergeInferredParameters([{ name: "numbers", type: "integer" }], [])).toEqual([]);
  });
});

describe("isSameParameterList", () => {
  it("ignores key order, missing lists and blank descriptions", () => {
    expect(
      isSameParameterList(
        [{ description: "销售价", type: "number", name: "price", required: true }],
        [{ name: "price", type: "number", required: true, description: "销售价" }],
      ),
    ).toBe(true);
    expect(isSameParameterList(undefined, [])).toBe(true);
    expect(isSameParameterList([{ name: "a", description: "" }], [{ name: "a" }])).toBe(true);
  });

  it("detects a changed nested description", () => {
    expect(
      isSameParameterList(
        [{ name: "o", type: "object", sub_parameters: [{ name: "x", description: "old" }] }],
        [{ name: "o", type: "object", sub_parameters: [{ name: "x", description: "new" }] }],
      ),
    ).toBe(false);
  });
});
