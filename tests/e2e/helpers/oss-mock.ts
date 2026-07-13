/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { APIRequestContext } from "@playwright/test";

export const OSS_MOCK_HOST_URL =
  process.env.E2E_OSS_MOCK_URL ?? "http://127.0.0.1:8080";
export const OSS_MOCK_DOCKER_URL = "http://ef-oss-mock:8080";

export function buildOfflineWeatherApiUrl() {
  return `${OSS_MOCK_DOCKER_URL}/proxy/uapis/weather`;
}

export async function assertOssMockHealthy(request: APIRequestContext) {
  const response = await request.get(`${OSS_MOCK_HOST_URL}/health`);
  if (!response.ok()) {
    throw new Error(`ef-oss-mock unavailable (${response.status()})`);
  }
}
