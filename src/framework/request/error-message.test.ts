/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { extractRequestErrorMessage } from "@/framework/request/error-message";

function createAxiosLikeError(data: unknown) {
  return {
    isAxiosError: true,
    response: { data },
  };
}

describe("extractRequestErrorMessage", () => {
  it("uses details when description is absent", () => {
    const message = extractRequestErrorMessage(
      createAxiosLikeError({
        details: "logic property[weather] result_path is invalid",
        message: "request failed",
      }),
    );

    expect(message).toBe("logic property[weather] result_path is invalid");
  });

  it("keeps description as the highest priority response message", () => {
    const message = extractRequestErrorMessage(
      createAxiosLikeError({
        description: "description message",
        details: "detail message",
      }),
    );

    expect(message).toBe("description message");
  });
});
