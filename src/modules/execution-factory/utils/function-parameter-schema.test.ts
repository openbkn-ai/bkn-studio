/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

// 真机抓的 api_spec：向 10.211.55.4 建了个带嵌套参数的函数工具再 GET 回来的原样响应。
import probeApiSpec from "./__fixtures__/function-api-spec.probe.json";
import {
  buildJsonSchemaFromParameters,
  parseFunctionParametersFromApiSpec,
} from "./function-parameter-schema";

describe("parseFunctionParametersFromApiSpec", () => {
  it("recovers nested inputs from a real backend api_spec", () => {
    const { inputs } = parseFunctionParametersFromApiSpec(probeApiSpec);

    expect(inputs).toEqual([
      {
        name: "customers",
        type: "array",
        description: "候选客户列表",
        required: true,
        sub_parameters: [
          {
            name: "item",
            type: "object",
            description: "单个客户",
            required: true,
            sub_parameters: [
              { name: "amount_1y", type: "number", description: "近一年金额", required: false },
              { name: "id", type: "string", description: "客户唯一标识", required: true },
            ],
          },
        ],
      },
      { name: "min_amount", type: "number", description: "金额阈值", required: false },
    ]);
  });

  it("recovers outputs from the result branch, ignoring runtime envelope fields", () => {
    const { outputs } = parseFunctionParametersFromApiSpec(probeApiSpec);

    expect(outputs?.map((item) => item.name)).toEqual(["matched", "total"]);
    expect(outputs?.[0]?.sub_parameters?.[0]?.sub_parameters?.map((item) => item.name)).toEqual([
      "id",
      "score",
    ]);
    // stdout / stderr / metrics 是沙箱回包字段，不是用户声明的出参。
    expect(outputs?.some((item) => ["stdout", "stderr", "metrics"].includes(item.name ?? ""))).toBe(
      false,
    );
  });

  it("accepts api_spec delivered as a JSON string", () => {
    const { inputs } = parseFunctionParametersFromApiSpec(JSON.stringify(probeApiSpec));

    expect(inputs?.map((item) => item.name)).toEqual(["customers", "min_amount"]);
  });

  it("returns nothing usable for a wiped spec instead of inventing parameters", () => {
    expect(
      parseFunctionParametersFromApiSpec({
        request_body: { content: { "application/json": { schema: { type: "object" } } } },
        responses: [
          {
            status_code: "200",
            content: {
              "application/json": {
                schema: { type: "object", properties: { result: { type: "object" } } },
              },
            },
          },
        ],
      }),
    ).toEqual({ inputs: undefined, outputs: undefined });
  });

  it("survives junk input", () => {
    expect(parseFunctionParametersFromApiSpec(undefined)).toEqual({});
    expect(parseFunctionParametersFromApiSpec("not json")).toEqual({});
    expect(parseFunctionParametersFromApiSpec(42)).toEqual({});
  });

  it("marks array elements required so the backend keeps the declared item shape", () => {
    const { inputs } = parseFunctionParametersFromApiSpec({
      request_body: {
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: { tags: { type: "array", items: { type: "string" } } },
            },
          },
        },
      },
    });

    expect(inputs).toEqual([
      {
        name: "tags",
        type: "array",
        description: undefined,
        required: false,
        sub_parameters: [
          { name: "item", type: "string", description: undefined, required: true },
        ],
      },
    ]);
  });
});

describe("buildJsonSchemaFromParameters", () => {
  it("returns null when there is nothing to describe", () => {
    expect(buildJsonSchemaFromParameters(undefined)).toBeNull();
    expect(buildJsonSchemaFromParameters([])).toBeNull();
    expect(buildJsonSchemaFromParameters([{ type: "string" }])).toBeNull();
  });

  it("maps declared parameters onto a JSON Schema object", () => {
    expect(
      buildJsonSchemaFromParameters([
        { name: "text", type: "string", required: true, description: "输入文本" },
        { name: "count", type: "integer" },
      ]),
    ).toEqual({
      type: "object",
      properties: {
        text: { type: "string", description: "输入文本" },
        count: { type: "integer" },
      },
      required: ["text"],
    });
  });

  it("expands nested objects and array items", () => {
    expect(
      buildJsonSchemaFromParameters([
        {
          name: "rows",
          type: "array",
          sub_parameters: [
            {
              name: "item",
              type: "object",
              sub_parameters: [{ name: "id", type: "string", required: true }],
            },
          ],
        },
      ]),
    ).toEqual({
      type: "object",
      properties: {
        rows: {
          type: "array",
          items: {
            type: "object",
            properties: { id: { type: "string" } },
            required: ["id"],
          },
        },
      },
    });
  });

  it("round-trips with the api_spec parser", () => {
    const { inputs } = parseFunctionParametersFromApiSpec(probeApiSpec);
    const schema = buildJsonSchemaFromParameters(inputs);

    expect(schema?.properties?.customers?.items?.properties?.id?.type).toBe("string");
    expect(schema?.required).toEqual(["customers"]);
  });
});
