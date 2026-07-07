/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OpenApiEndpointReview } from "@/modules/execution-factory/components/OpenApiEndpointReview";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string; count?: number }) =>
      options?.defaultValue ?? String(options?.count ?? _key),
  }),
}));

describe("OpenApiEndpointReview", () => {
  it("renders endpoint method, path, summary, risk, and IO counts", () => {
    const spec = JSON.stringify({
      openapi: "3.0.3",
      info: { title: "Weather API", version: "1.0.0" },
      servers: [{ url: "http://host.docker.internal:8080" }],
      paths: {
        "/weather": {
          get: {
            summary: "Query weather",
            parameters: [
              {
                name: "city",
                in: "query",
                schema: { type: "string" },
              },
            ],
            responses: { "200": { description: "OK" } },
          },
        },
        "/weather/alert": {
          post: {
            summary: "Create weather alert",
            responses: { "200": { description: "OK" } },
          },
        },
      },
    });

    render(<OpenApiEndpointReview openapiSpec={spec} />);

    expect(screen.getByText("Endpoint review")).toBeTruthy();
    expect(screen.getByText("GET")).toBeTruthy();
    expect(screen.getByText("/weather")).toBeTruthy();
    expect(screen.getByText("Query weather")).toBeTruthy();
    expect(screen.getByText("low")).toBeTruthy();
    expect(screen.getByText("1 input · 1 response")).toBeTruthy();
    expect(screen.getByText("POST")).toBeTruthy();
    expect(screen.getByText("/weather/alert")).toBeTruthy();
    expect(screen.getByText("medium")).toBeTruthy();
  });
});
