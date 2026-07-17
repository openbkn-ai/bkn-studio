/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  buildToolDebugRequest,
  normalizeToolApiSpecResponses,
  parseToolIoSpec,
} from "@/modules/execution-factory/utils/tool-io";

describe("buildToolDebugRequest", () => {
  it("splits flat debug input by OpenAPI parameter location", () => {
    expect(
      buildToolDebugRequest(
        {
          accept: "application/json",
          customerId: "1001",
          region: "CN",
          resourceId: "resource-1",
          "x-demo-source": "openbkn-manual",
        },
        {
          parameters: [
            { in: "query", name: "customerId", type: "string" },
            { in: "query", name: "region", type: "string" },
            { in: "header", name: "accept", type: "string" },
            { in: "header", name: "x-demo-source", type: "string" },
            { in: "path", name: "resourceId", type: "string" },
          ],
        },
      ),
    ).toEqual({
      header: {
        accept: "application/json",
        "x-demo-source": "openbkn-manual",
      },
      query: {
        customerId: "1001",
        region: "CN",
      },
      path: {
        resourceId: "resource-1",
      },
    });
  });

  it("preserves explicit query/header/body debug payloads", () => {
    expect(
      buildToolDebugRequest({
        body: { city: "Beijing" },
        header: { accept: "application/json" },
        path: { resourceId: 1001 },
        query: { region: "CN" },
      }),
    ).toEqual({
      body: { city: "Beijing" },
      header: { accept: "application/json" },
      path: { resourceId: "1001" },
      query: { region: "CN" },
    });
  });

  it("keeps unknown flat fields in the request body", () => {
    expect(
      buildToolDebugRequest(
        { city: "Beijing", traceId: "debug-1" },
        { parameters: [{ in: "query", name: "city", type: "string" }] },
      ),
    ).toEqual({
      body: { traceId: "debug-1" },
      query: { city: "Beijing" },
    });
  });
});

describe("parseToolIoSpec", () => {
  it("normalizes array responses and resolves local schema refs", () => {
    const ioSpec = parseToolIoSpec({
      method: "POST",
      path: "/resolve",
      api_spec: {
        parameters: [
          {
            name: "x-account-id",
            in: "header",
            required: true,
            description: "account id",
            schema: { type: "string" },
          },
          {
            name: "response_format",
            in: "query",
            required: false,
            schema: { type: "string" },
          },
        ],
        request_body: {
          required: true,
          content: {
            "application/json": {
              examples: {
                demo: {
                  value: {
                    kn_id: "kn_medical",
                    ot_id: "company",
                  },
                },
              },
              schema: {
                $ref: "#/components/schemas/ResolveLogicPropertiesRequest",
              },
            },
          },
        },
        responses: [
          {
            status_code: "200",
            description: "ok",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ResolveLogicPropertiesResponse",
                },
              },
            },
          },
          {
            status_code: "400",
            description: "bad request",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/Error",
                },
              },
            },
          },
        ],
        components: {
          schemas: {
            ResolveLogicPropertiesRequest: {
              type: "object",
              description: "resolve request",
              required: ["kn_id", "ot_id"],
              properties: {
                kn_id: { type: "string" },
                ot_id: { type: "string" },
                properties: {
                  type: "array",
                  items: { type: "string" },
                },
              },
            },
            ResolveLogicPropertiesResponse: {
              type: "object",
              properties: {
                values: { type: "object" },
              },
            },
            Error: {
              type: "object",
              properties: {
                message: { type: "string" },
              },
            },
          },
        },
      },
    });

    expect(ioSpec?.parameters).toEqual([
      {
        name: "x-account-id",
        in: "header",
        required: true,
        description: "account id",
        type: "string",
      },
      {
        name: "response_format",
        in: "query",
        required: false,
        description: undefined,
        type: "string",
      },
    ]);
    expect(ioSpec?.requestBodyExample).toEqual({
      kn_id: "kn_medical",
      ot_id: "company",
    });
    expect(ioSpec?.requestBodyDescription).toBe("resolve request");
    expect(ioSpec?.requestBodySchema).toMatchObject({
      type: "object",
      required: ["kn_id", "ot_id"],
      properties: {
        kn_id: { type: "string" },
        ot_id: { type: "string" },
      },
    });
    expect(Object.keys(ioSpec?.responses ?? {})).toEqual(["200", "400"]);
    expect(ioSpec?.responses?.["200"]?.schema).toMatchObject({
      type: "object",
      properties: {
        values: { type: "object" },
      },
    });
  });

  it("keeps object-map responses compatible", () => {
    expect(
      normalizeToolApiSpecResponses({
        "201": { description: "created" },
      }),
    ).toEqual({
      "201": { description: "created" },
    });
  });
});
