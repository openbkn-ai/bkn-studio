/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { describe, expect, it } from "vitest";
import { extractRequestErrorDetail } from "./request-error-detail";

describe("extractRequestErrorDetail", () => {
  it.each(["detail", "details"])("preserves %s alongside a shared code", (field) => {
    expect(
      extractRequestErrorDetail({
        isAxiosError: true,
        response: {
          data: {
            error_code: "Tool.Invalid",
            description: "Bad input",
            [field]: "Check the name",
          },
        },
      }),
    ).toMatchObject({ detail: "Check the name" });
  });
  it.each([0, false, "Current detail", { field: "name" }])(
    "prefers shared detail %j over legacy fields",
    (detail) => {
      expect(
        extractRequestErrorDetail({
          isAxiosError: true,
          response: {
            data: {
              error_code: "Tool.Invalid",
              error_details: detail,
              detail: "old",
              details: "older",
            },
          },
        }),
      ).toMatchObject({ detail });
    },
  );

  it("uses a shared error code when the downstream description is empty", () => {
    expect(
      extractRequestErrorDetail({
        isAxiosError: true,
        response: {
          data: {
            error_code: "Public.Forbidden",
            description: "",
            error_details: { field: "title" },
          },
        },
      }),
    ).toMatchObject({
      message: "Public.Forbidden",
      code: "Public.Forbidden",
      detail: { field: "title" },
    });
  });
  it("ignores legacy shared guidance and links", () => {
    expect(
      extractRequestErrorDetail({
        isAxiosError: true,
        response: {
          data: {
            error_code: "Public.Forbidden",
            description: "Access denied",
            solution: "Request access",
            error_link: "https://example.com/access",
          },
        },
      }),
    ).toEqual({
      message: "Access denied",
      code: "Public.Forbidden",
      description: "Access denied",
      detail: undefined,
    });
  });
  it("reads legacy code and details while ignoring guidance fields", () => {
    expect(
      extractRequestErrorDetail({
        isAxiosError: true,
        response: {
          data: {
            code: "agentRetrieval.Invalid",
            description: "Bad argument",
            solution: "Check argument",
            link: "https://example.com/argument",
            details: "context",
          },
        },
      }),
    ).toEqual({
      message: "Bad argument",
      description: "Bad argument",
      code: "agentRetrieval.Invalid",
      detail: "context",
    });
  });
});
