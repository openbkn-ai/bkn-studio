/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** Keep server metadata alongside editable fields; unknown schema keywords survive a PUT. */
export type ApiResourceField = Record<string, unknown> & {
  name: string;
  original_name: string;
  type: string;
  display_name?: string;
  description?: string;
  filterable?: boolean;
  attributes?: Record<string, unknown> | null;
};

export type ApiResourceInput = {
  catalog_id: string;
  name: string;
  description: string;
  tags: string[];
  enabled: boolean;
  schema_definition: ApiResourceField[];
  api_definition: Record<string, unknown>;
};

export type ApiResource = ApiResourceInput & {
  id: string;
  source_identifier: string;
  category: "api";
  api_effect_type: "read";
  update_time: number;
  status: string;
  operations: string[];
  create_time?: number;
  creator?: { id?: string; name?: string };
  updater?: { id?: string; name?: string };
};

export type ApiResourceQuery = {
  filter_condition?: Record<string, unknown>;
  paging?: { mode: "single"; offset?: number; limit?: number };
  need_total?: boolean;
};

/** Transient candidate verification; never persisted as part of the Resource definition. */
export type ApiResourceValidation = Pick<ApiResourceQuery, "filter_condition" | "paging">;

export type ApiResourceResult = {
  entries: Record<string, unknown>[];
  query_source?: string;
  is_approximate?: boolean;
  total_count?: number | string;
  paging?: Record<string, unknown>;
  warnings?: unknown[];
};
