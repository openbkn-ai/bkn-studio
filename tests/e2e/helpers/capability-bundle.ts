/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { APIRequestContext } from "@playwright/test";

import { API_PREFIX, defaultApiHeaders, expectOk } from "./common";

export type RegisterOpenApiBundleViaApiInput = {
  openapiSpec: string;
  serviceUrl: string;
  boxId?: string;
  toolboxName?: string;
  toolboxDescription?: string;
  category?: string;
  useRule?: string;
  directPublish?: boolean;
  operatorCategory?: string;
};

export async function registerOpenApiBundleViaApi(
  request: APIRequestContext,
  input: RegisterOpenApiBundleViaApiInput,
) {
  const response = await request.post(`${API_PREFIX}/capabilities/openapi-bundle`, {
    headers: {
      ...defaultApiHeaders(),
      "Content-Type": "application/json",
    },
    data: {
      box_id: input.boxId,
      box_name: input.toolboxName,
      box_desc: input.toolboxDescription,
      box_svc_url: input.serviceUrl,
      box_category: input.category ?? "other_category",
      use_rule: input.useRule,
      data: input.openapiSpec,
      direct_publish: input.directPublish ?? false,
      operator_info: {
        category: input.operatorCategory ?? input.category ?? "other_category",
        execution_mode: "sync",
        operator_type: "basic",
        source: "custom",
      },
    },
  });

  await expectOk(response, "Register OpenAPI bundle");
  return response.json() as Promise<{
    box_id?: string;
    tool_ids?: string[];
    operator_ids?: string[];
    links?: Array<{ operator_id?: string; tool_id?: string }>;
    failure_count?: number;
    failures?: string[];
  }>;
}
