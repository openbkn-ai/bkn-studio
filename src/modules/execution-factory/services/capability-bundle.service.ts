/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import { getRuntimeConfig } from "@/framework/runtime/config";
import type { OperatorSyncPublishInput } from "@/modules/execution-factory/types/operator-sync";

const API_PREFIX = "/agent-operator-integration/v1";
const DEFAULT_BUSINESS_DOMAIN = "bd_public";

function getBusinessDomainHeaders() {
  const businessDomainId =
    getRuntimeConfig().currentUser.businessDomainId ?? DEFAULT_BUSINESS_DOMAIN;

  return { "x-business-domain": businessDomainId };
}

export type RegisterOpenApiBundleInput = {
  openapiSpec: string;
  serviceUrl: string;
  boxId?: string;
  toolboxName?: string;
  toolboxDescription?: string;
  category?: string;
  useRule?: string;
  operatorSync: OperatorSyncPublishInput;
};

export type OpenApiBundleLink = {
  operatorId: string;
  toolId: string;
};

export type RegisterOpenApiBundleResult = {
  boxId: string;
  toolIds: string[];
  operatorIds: string[];
  links: OpenApiBundleLink[];
  failureCount: number;
  failures: string[];
};

type BackendBundleResponse = {
  box_id?: string;
  tool_ids?: string[];
  operator_ids?: string[];
  links?: Array<{ operator_id?: string; tool_id?: string }>;
  failure_count?: number;
  failures?: string[];
};

export async function registerOpenApiBundle(
  input: RegisterOpenApiBundleInput,
): Promise<RegisterOpenApiBundleResult> {
  const response = await http.post<BackendBundleResponse>(
    `${API_PREFIX}/capabilities/openapi-bundle`,
    {
      box_id: input.boxId,
      box_name: input.toolboxName,
      box_desc: input.toolboxDescription,
      box_svc_url: input.serviceUrl,
      box_category: input.category ?? input.operatorSync.category ?? "other_category",
      use_rule: input.useRule,
      data: input.openapiSpec,
      direct_publish: input.operatorSync.directPublish ?? false,
      operator_info: {
        category: input.operatorSync.category ?? input.category ?? "other_category",
        execution_mode: "sync",
        operator_type: "basic",
        source: "custom",
      },
      operator_execute_control: input.operatorSync.executeControl,
    },
    { headers: getBusinessDomainHeaders(), skipErrorToast: true },
  );

  const body = response.data;
  if (!body.box_id || !(body.tool_ids?.length)) {
    throw new Error("OpenAPI bundle registration failed");
  }

  return {
    boxId: body.box_id,
    toolIds: body.tool_ids ?? [],
    operatorIds: body.operator_ids ?? [],
    links: (body.links ?? []).map((link) => ({
      operatorId: link.operator_id ?? "",
      toolId: link.tool_id ?? "",
    })),
    failureCount: body.failure_count ?? 0,
    failures: body.failures ?? [],
  };
}
