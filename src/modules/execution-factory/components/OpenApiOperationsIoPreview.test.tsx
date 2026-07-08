/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OpenApiOperationsIoPreview } from "@/modules/execution-factory/components/OpenApiOperationsIoPreview";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === "executionFactory.openapiOperationsIoPreviewHint") {
        return "Expand to review IO.";
      }
      if (key === "executionFactory.openapiOperationIoSummaryWithBody") {
        return `${options?.paramCount} URL/Header parameters · request body ${options?.bodyFieldCount} fields · ${options?.responseCount} responses`;
      }
      if (key === "executionFactory.openapiOperationIoSummary") {
        return `${options?.paramCount} URL/Header parameters · ${options?.responseCount} responses`;
      }
      return key;
    },
  }),
}));

describe("OpenApiOperationsIoPreview", () => {
  it("summarizes request body fields separately from URL/header parameters", () => {
    const spec = JSON.stringify({
      openapi: "3.0.3",
      info: { title: "Login API", version: "1.0.0" },
      servers: [{ url: "https://api.example.com" }],
      paths: {
        "/login": {
          post: {
            summary: "login",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      username: { type: "string", example: "test" },
                      password: { type: "string", example: "123456" },
                    },
                  },
                  example: { username: "test", password: "123456" },
                },
              },
            },
            responses: {
              "200": { description: "OK" },
            },
          },
        },
      },
    });

    render(<OpenApiOperationsIoPreview openapiSpec={spec} />);

    expect(
      screen.getByText("0 URL/Header parameters · request body 2 fields · 1 responses"),
    ).toBeTruthy();
  });
});
