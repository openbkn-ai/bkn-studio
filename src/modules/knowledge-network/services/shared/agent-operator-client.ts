/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import { getExecutionFactoryApiHeaders } from "@/modules/execution-factory/utils/execution-factory-api-headers";

export const AGENT_OPERATOR_API_PREFIX = "/agent-operator-integration/v1";

/** Backend validates page_size with max=100. */
export const AGENT_OPERATOR_PAGE_SIZE = 100;

export const MAX_AGENT_OPERATOR_PAGES = 20;

export { getExecutionFactoryApiHeaders as getAgentOperatorHeaders };

export type AgentOperatorListItem = {
  metadata?: { api_spec?: unknown };
  name?: string;
  operator_id: string;
};

type AgentOperatorListResponse = {
  data?: AgentOperatorListItem[];
  has_next?: boolean;
  total?: number;
};

export async function fetchPublishedOperatorListPage(
  page: number,
  options: { keyword?: string; pageSize?: number } = {},
): Promise<AgentOperatorListResponse> {
  const response = await http.get<AgentOperatorListResponse>(
    `${AGENT_OPERATOR_API_PREFIX}/operator/info/list`,
    {
      headers: getExecutionFactoryApiHeaders(),
      params: {
        name: options.keyword || undefined,
        page,
        page_size: options.pageSize ?? AGENT_OPERATOR_PAGE_SIZE,
        sort_by: "update_time",
        sort_order: "desc",
        status: "published",
      },
      skipErrorToast: true,
    },
  );

  return response.data;
}

export async function listAllPublishedOperators<T>(
  mapItem: (item: AgentOperatorListItem) => T,
): Promise<T[]> {
  const operators: T[] = [];
  let page = 1;
  let total = 0;

  do {
    const result = await fetchPublishedOperatorListPage(page);
    total = result.total ?? operators.length;
    const batch = result.data ?? [];

    if (batch.length === 0) {
      break;
    }

    operators.push(...batch.map(mapItem));

    if (result.has_next === false || operators.length >= total) {
      break;
    }

    page += 1;
  } while (page <= MAX_AGENT_OPERATOR_PAGES);

  return operators;
}
