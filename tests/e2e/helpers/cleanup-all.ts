/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { APIRequestContext } from "@playwright/test";

import { API_PREFIX, defaultApiHeaders } from "./common";

const TEST_NAME_PATTERNS = [
  /^at_e2e_/i,
  /^e2e_/i,
  /^demo_/i,
  /^quick_api_/i,
];

export type CleanupSummary = {
  operators: number;
  toolboxes: number;
  mcps: number;
  skills: number;
  dryRun: boolean;
};

function isTestAssetName(name: string | undefined) {
  if (!name) {
    return false;
  }
  return TEST_NAME_PATTERNS.some((pattern) => pattern.test(name));
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) ${url}: ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

async function listAllPages<T>(
  buildUrl: (page: number) => string,
  pickItems: (body: Record<string, unknown>) => T[],
) {
  const items: T[] = [];
  for (let page = 1; page <= 50; page += 1) {
    const body = (await fetchJson<Record<string, unknown>>(buildUrl(page), {
      headers: defaultApiHeaders(),
    })) as Record<string, unknown>;
    const pageItems = pickItems(body);
    items.push(...pageItems);
    const total = Number(body.total ?? body.count ?? 0);
    const pageSize = Number(body.page_size ?? pageItems.length ?? 20);
    if (!pageItems.length || page * pageSize >= total) {
      break;
    }
  }
  return items;
}

export async function cleanupAllE2eAssets(
  request?: APIRequestContext,
  options?: { dryRun?: boolean },
): Promise<CleanupSummary> {
  const dryRun = options?.dryRun ?? false;
  const summary: CleanupSummary = {
    operators: 0,
    toolboxes: 0,
    mcps: 0,
    skills: 0,
    dryRun,
  };

  const headers = defaultApiHeaders();
  const jsonHeaders = { ...headers, "Content-Type": "application/json" };

  const post = async (url: string, data: unknown) => {
    if (dryRun) {
      return;
    }
    if (request) {
      const response = await request.post(url, { headers: jsonHeaders, data });
      if (!response.ok()) {
        console.warn(`POST ${url} failed: ${response.status()} ${await response.text()}`);
      }
      return;
    }
    await fetch(url, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
  };

  const del = async (url: string, data?: unknown) => {
    if (dryRun) {
      return;
    }
    if (request) {
      const response = await request.delete(url, {
        headers: jsonHeaders,
        data,
      });
      if (!response.ok()) {
        console.warn(`DELETE ${url} failed: ${response.status()} ${await response.text()}`);
      }
      return;
    }
    await fetch(url, {
      method: "DELETE",
      headers: jsonHeaders,
      body: data ? JSON.stringify(data) : undefined,
    });
  };

  const operators = await listAllPages(
    (page) => `${API_PREFIX}/operator/info/list?page=${page}&page_size=100`,
    (body) =>
      ((body.data as Array<{ operator_id: string; version: string; name?: string }>) ?? []).filter(
        (item) => isTestAssetName(item.name),
      ),
  );
  for (const operator of operators) {
    summary.operators += 1;
    await post(`${API_PREFIX}/operator/status`, [
      { operator_id: operator.operator_id, version: operator.version, status: "offline" },
    ]);
    await del(`${API_PREFIX}/operator/delete`, [
      { operator_id: operator.operator_id, version: operator.version },
    ]);
  }

  const toolboxes = await listAllPages(
    (page) => `${API_PREFIX}/tool-box/list?page=${page}&page_size=100`,
    (body) =>
      (
        (body.data as Array<{ box_id: string; box_name?: string; name?: string }>) ?? []
      ).filter((item) => isTestAssetName(item.box_name ?? item.name)),
  );
  for (const toolbox of toolboxes) {
    summary.toolboxes += 1;
    await post(`${API_PREFIX}/tool-box/${toolbox.box_id}/status`, { status: "offline" });
    await del(`${API_PREFIX}/tool-box/${toolbox.box_id}`);
  }

  const mcps = await listAllPages(
    (page) => `${API_PREFIX}/mcp/list?page=${page}&page_size=100`,
    (body) =>
      ((body.data as Array<{ mcp_id: string | number; name?: string }>) ?? []).filter((item) =>
        isTestAssetName(item.name),
      ),
  );
  for (const mcp of mcps) {
    summary.mcps += 1;
    const mcpId = String(mcp.mcp_id);
    await post(`${API_PREFIX}/mcp/${mcpId}/status`, { status: "offline" });
    await del(`${API_PREFIX}/mcp/${mcpId}`);
  }

  const skills = await listAllPages(
    (page) => `${API_PREFIX}/skills?page=${page}&page_size=100`,
    (body) =>
      ((body.data as Array<{ skill_id: string; name?: string }>) ?? []).filter((item) =>
        isTestAssetName(item.name),
      ),
  );
  for (const skill of skills) {
    summary.skills += 1;
    await post(`${API_PREFIX}/skills/${skill.skill_id}/status`, { status: "offline" });
    await del(`${API_PREFIX}/skills/${skill.skill_id}`);
  }

  return summary;
}

export async function assertBackendReadyForCleanup(request?: APIRequestContext) {
  const url = `${API_PREFIX}/operator/info/list?page=1&page_size=1`;
  if (request) {
    const response = await request.get(url, { headers: defaultApiHeaders() });
    if (!response.ok()) {
      throw new Error(`Backend unavailable (${response.status()})`);
    }
    return;
  }
  const response = await fetch(url, { headers: defaultApiHeaders() });
  if (!response.ok) {
    throw new Error(`Backend unavailable (${response.status})`);
  }
}
