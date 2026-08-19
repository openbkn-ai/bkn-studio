/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { AxiosError, AxiosHeaders } from "axios";

const STATUS_TEXT: Record<number, string> = {
  400: "Bad Request",
  404: "Not Found",
  409: "Conflict",
};

export function throwMockRequestError(
  status: number,
  errorCode: string,
  description: string,
): never {
  const error = new AxiosError(description);
  error.response = {
    config: { headers: new AxiosHeaders() },
    data: {
      description,
      error_code: errorCode,
    },
    headers: {},
    status,
    statusText: STATUS_TEXT[status] ?? "Error",
  };
  throw error;
}

export function validateMockExpectedUpdateTime(expectedUpdateTime: number): void {
  if (!Number.isFinite(expectedUpdateTime) || expectedUpdateTime <= 0) {
    throwMockRequestError(
      400,
      "VegaBackend.InvalidParameter.RequestBody",
      "expected_update_time is required and must be greater than 0.",
    );
  }
}
