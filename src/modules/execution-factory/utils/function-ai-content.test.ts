/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { parseFunctionAiContent } from "./function-ai-content";

describe("parseFunctionAiContent", () => {
  it("takes the raw string as code for the python generator", () => {
    const result = parseFunctionAiContent(
      "python_function_generator",
      "def handler(event):\n    return event\n",
    );

    expect(result).toEqual({
      type: "code",
      code: "def handler(event):\n    return event\n",
    });
  });

  it("unwraps code returned inside an object", () => {
    const result = parseFunctionAiContent("python_function_generator", {
      code: "def handler(event):\n    return {}\n",
    });

    expect(result).toEqual({ type: "code", code: "def handler(event):\n    return {}\n" });
  });

  it("maps metadata results onto form-ready fields", () => {
    const result = parseFunctionAiContent("metadata_param_generator", {
      description: "Filter high value customers.",
      inputs: [{ name: "customers", type: "array", description: "candidates" }],
      name: "high_value_customers",
      outputs: [{ name: "total", type: "number" }],
      use_rule: "Call when segmenting customers.",
    });

    expect(result).toEqual({
      type: "metadata",
      description: "Filter high value customers.",
      inputs: [{ name: "customers", type: "array", description: "candidates" }],
      name: "high_value_customers",
      outputs: [{ name: "total", type: "number", description: undefined }],
      useRule: "Call when segmenting customers.",
    });
  });

  it("recurses into sub_parameters and keeps required", () => {
    const result = parseFunctionAiContent("metadata_param_generator", {
      name: "segment",
      inputs: [
        {
          name: "customers",
          type: "array",
          required: true,
          sub_parameters: [
            {
              name: "profile",
              type: "object",
              required: false,
              sub_parameters: [{ name: "id", type: "string", required: true }],
            },
          ],
        },
      ],
    });

    expect(result).toMatchObject({
      inputs: [
        {
          name: "customers",
          type: "array",
          required: true,
          sub_parameters: [
            {
              name: "profile",
              type: "object",
              required: false,
              sub_parameters: [{ name: "id", type: "string", required: true }],
            },
          ],
        },
      ],
    });
  });

  it("parses metadata delivered as a JSON string", () => {
    const result = parseFunctionAiContent(
      "metadata_param_generator",
      '{"name":"normalize","inputs":[{"name":"raw","type":"string"}]}',
    );

    expect(result).toMatchObject({
      type: "metadata",
      name: "normalize",
      inputs: [{ name: "raw", type: "string" }],
    });
  });

  it("accepts camelCase useRule and desc aliases", () => {
    const result = parseFunctionAiContent("metadata_param_generator", {
      useRule: "Call sparingly.",
      outputs: [{ name: "ok", desc: "done" }],
    });

    expect(result).toMatchObject({
      useRule: "Call sparingly.",
      outputs: [{ name: "ok", type: "string", description: "done" }],
    });
  });

  it("drops parameter entries without a name", () => {
    const result = parseFunctionAiContent("metadata_param_generator", {
      name: "fn",
      inputs: [{ type: "string" }, "nope", { name: "kept", type: "number" }],
    });

    expect(result).toMatchObject({ inputs: [{ name: "kept", type: "number" }] });
  });

  it("returns null when nothing usable came back", () => {
    expect(parseFunctionAiContent("metadata_param_generator", { junk: 1 })).toBeNull();
    expect(parseFunctionAiContent("metadata_param_generator", "not json")).toBeNull();
    expect(parseFunctionAiContent("python_function_generator", { nope: true })).toBeNull();
    expect(parseFunctionAiContent("python_function_generator", "   ")).toBeNull();
  });
});
