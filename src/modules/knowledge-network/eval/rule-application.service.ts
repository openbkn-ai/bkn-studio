/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { EvalRuleCheck } from "./rule-check-model";
import type { CaseTargetSchema } from "./case-form.service";

import axios from "axios";
import type { EvalCaseDefinition } from "./m0-run.service";
import {
  parsePrecisionPreservingJSON,
  transformPrecisionSafeJSONRequest,
} from "@/framework/request/precision-safe-json";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { http } from "@/framework/request/http";

export type RuleApplicationResource = { kind: string; id: string };
export type RuleApplicationTarget = { resource_key: string; rule_id: string; target_id?: string };
export type RuleApplicationSeed = {
  targets?: RuleApplicationTarget[];
  ruleIds: string[];
  resources?: RuleApplicationResource[];
};
export type RuleApplicationSample = {
  definition_only?: boolean;
  target_key: string;
  sample_id: string;
  rule_checksum?: string;
  resource_checksum?: string;
  title: string;
  question: string;
  arguments: Record<string, unknown>;
  scope: Record<string, unknown>;
  expected?: Record<string, unknown>;
  assertions?: Record<string, unknown>[];
  source_kind?: "declared_contract" | "independent_sample" | "business_expert";
  evidence_refs?: string[];
};
export type RuleApplicationRow = {
  check?: EvalRuleCheck;
  input_contract?: CaseTargetSchema;
  prepared_definition?: EvalCaseDefinition;
  ready_for_save?: boolean;
  save_error?: string;
  key: string;
  target_key: string;
  resource: RuleApplicationResource;
  resource_name: string;
  target_id: string;
  target_name: string;
  rule_id: string;
  rule_title: string;
  rule_checksum: string;
  resource_checksum: string;
  match: "applicable" | "not_applicable" | "unverified" | "excluded" | "disabled";
  match_reason?: string;
  configuration: "complete" | "incomplete";
  execution: string;
  execution_reason: string;
  missing: string[];
  expected_locked?: boolean;
  sample: RuleApplicationSample;
  existing_case_id?: string;
  existing_status?: "reused" | "conflict";
  existing_reason?: string;
};
export type RuleApplicationRequest = {
  targets?: RuleApplicationTarget[];
  resources: RuleApplicationResource[];
  rule_ids: string[];
  samples?: RuleApplicationSample[];
  page: number;
  limit: number;
  q?: string;
  only_samples?: boolean;
};
export type RuleApplicationPreview = {
  entries: RuleApplicationRow[];
  total: number;
  page: number;
  limit: number;
  scope_revision: number;
};
export type RuleApplicationSavedItem = {
  key: string;
  status: "created" | "reused" | "conflict" | "invalid" | "failed" | "pending" | "unconfirmed";
  case_id?: string;
  reason?: string;
};
const base = (networkId: string) =>
  `/bkn-backend/v1/knowledge-networks/${encodeURIComponent(networkId)}/evals/rule-applications`;
const precisionConfig = {
  skipErrorToast: true,
  headers: { "Content-Type": "application/json" },
  transformRequest: transformPrecisionSafeJSONRequest,
  transformResponse: (data: unknown) => {
    if (typeof data !== "string" || !data.length) return data;
    try {
      return parsePrecisionPreservingJSON(data);
    } catch {
      return data;
    }
  },
};
export async function previewRuleApplication(networkId: string, request: RuleApplicationRequest) {
  const response = await http.post<RuleApplicationPreview>(
    `${base(networkId)}/preview`,
    request,
    precisionConfig,
  );
  return response.data;
}
export async function saveRuleApplication(
  networkId: string,
  request: RuleApplicationRequest,
  onProgress?: (entries: RuleApplicationSavedItem[]) => void,
) {
  const samples = request.samples ?? [];
  const key = (sample: RuleApplicationSample) => `${sample.target_key}:${sample.sample_id}`;
  const results = new Map<string, RuleApplicationSavedItem>(
    samples.map((sample) => [key(sample), { key: key(sample), status: "pending" }]),
  );
  const publish = () => onProgress?.([...results.values()]);
  publish();
  // Bound each request rather than raising the global timeout. Earlier receipts
  // survive a later transport failure; unknown commits can be retried idempotently.
  for (let offset = 0; offset < samples.length; offset += 5) {
    const chunk = samples.slice(offset, offset + 5);
    try {
      const response = await http.post<{ entries: RuleApplicationSavedItem[] }>(
        `${base(networkId)}/save`,
        { ...request, samples: chunk },
        precisionConfig,
      );
      for (const entry of response.data.entries) results.set(entry.key, entry);
      publish();
    } catch (cause) {
      const status =
        axios.isAxiosError(cause) && cause.response
          ? cause.response.status === 409
            ? "conflict"
            : cause.response.status === 400
              ? "invalid"
              : "failed"
          : "unconfirmed";
      for (const sample of chunk)
        results.set(key(sample), {
          key: key(sample),
          status,
          ...(axios.isAxiosError(cause) && cause.response
            ? { reason: extractRequestErrorMessage(cause) }
            : {}),
        });
      publish();
      throw cause;
    }
  }
  return [...results.values()];
}
