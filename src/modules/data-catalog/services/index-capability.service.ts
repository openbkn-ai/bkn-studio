/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";

export type IndexCapabilities = {
  checkedAt: number;
  fulltextAnalyzers: string[];
};

type BackendIndexCapabilities = {
  checked_at?: number;
  fulltext_analyzers?: Array<{ id?: string }>;
};

export async function getIndexCapabilities(): Promise<IndexCapabilities> {
  const response = await http.get<BackendIndexCapabilities>("/vega-backend/v1/index-capabilities");
  return {
    checkedAt: response.data.checked_at ?? 0,
    fulltextAnalyzers: (response.data.fulltext_analyzers ?? [])
      .map((item) => item.id?.trim())
      .filter((id): id is string => Boolean(id)),
  };
}
