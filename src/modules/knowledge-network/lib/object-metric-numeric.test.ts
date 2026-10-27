/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it, vi } from "vitest";

import {
  formatObjectMetricNumericInput,
  objectMetricAuthoringNumericValue,
  parseObjectMetricNumericInput,
  serializeObjectMetricBody,
} from "./object-metric-numeric";

describe("object metric numeric input", () => {
  it("sends large integers and long decimals as JSON numbers without rounding", () => {
    const identity = parseObjectMetricNumericInput("9007199254740993");
    const having = parseObjectMetricNumericInput("0.1234567890123456789012345");
    expect(serializeObjectMetricBody({ identity, having })).toBe(
      '{"identity":9007199254740993,"having":0.1234567890123456789012345}',
    );
  });

  it("restores exact numeric literals when a definition was parsed as strings", () => {
    const definition = {
      specification: {
        measure: {
          expression: {
            node_type: "literal",
            value_type: "decimal",
            value: "0.1234567890123456789012345",
          },
        },
      },
      code: "000123",
    };
    expect(serializeObjectMetricBody(definition)).toContain('"value":0.1234567890123456789012345');
    expect(serializeObjectMetricBody(definition)).toContain('"code":"000123"');
  });

  it("rejects nonnumeric text without treating it as a JSON string literal", () => {
    expect(parseObjectMetricNumericInput("123abc")).toBeUndefined();
  });

  it.each([
    ["007", "7"],
    ["+1", "1"],
    [".5", "0.5"],
    ["1.", "1"],
  ])("normalizes compatible UI input %s to a valid JSON number", (input, expected) => {
    const value = parseObjectMetricNumericInput(input);
    expect(value).not.toBeUndefined();
    expect(serializeObjectMetricBody({ value })).toBe(`{"value":${expected}}`);
  });

  it("keeps duration literals numeric at the API boundary", () => {
    expect(
      serializeObjectMetricBody({
        node_type: "literal",
        value_type: "duration",
        value: "3600000.000000000000000001",
      }),
    ).toBe('{"node_type":"literal","value_type":"duration","value":3600000.000000000000000001}');
  });

  it("marks serialized bodies as JSON when Axios applies the request transformer", () => {
    const set = vi.fn();
    expect(serializeObjectMetricBody({ value: 1 }, { set })).toBe('{"value":1}');
    expect(set).toHaveBeenCalledWith("Content-Type", "application/json");
  });

  it("keeps simple authoring values numeric and precise values as exact text", () => {
    expect(objectMetricAuthoringNumericValue("199.50")).toBe(199.5);
    expect(objectMetricAuthoringNumericValue("9007199254740993")).toBe("9007199254740993");
    expect(formatObjectMetricNumericInput(parseObjectMetricNumericInput("9007199254740993"))).toBe(
      "9007199254740993",
    );
  });

  it("does not silently underflow a short scientific literal to zero", () => {
    const tiny = parseObjectMetricNumericInput("1e-324");
    expect(formatObjectMetricNumericInput(tiny)).toBe("1e-324");
    expect(objectMetricAuthoringNumericValue("1e-324")).toBe("1e-324");
    expect(serializeObjectMetricBody({ value: tiny })).toBe('{"value":1e-324}');
  });
});
