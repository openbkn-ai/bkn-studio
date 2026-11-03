/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import axios from "axios";
import { http } from "@/framework/request/http";

export type KnowledgeRefreshStatus = {
  available: boolean;
  networkId: string;
  state: string;
  reason: string;
  revision: number;
  canManage: boolean;
  canRelease: boolean;
  canDiscard: boolean;
  files: number;
  changed: number;
  removed: number;
  reused: number;
  completed: number;
  pendingLinks: number;
  pendingFields: number;
  pendingFacts: number;
  estimatedMillis: number | null;
  reviewReasons: string[];
  updateTime: number;
  limits: { changedPercent: number; removedPercent: number; durationMillis: number };
};

type BackendRefresh = {
  available: boolean;
  network_id?: string;
  state: string;
  reason?: string;
  revision: number;
  can_manage: boolean;
  can_release: boolean;
  can_discard: boolean;
  files: number;
  changed: number;
  removed: number;
  reused: number;
  completed: number;
  pending_links: number;
  pending_fields: number;
  pending_facts: number;
  estimate?: { duration_millis?: number; reasons?: string[] | null };
  update_time: number;
  limits: { max_changed_percent: number; max_removed_percent: number; max_duration_millis: number };
};

const path = (lineage: string) =>
  `/bkn-project/v1/lineages/${encodeURIComponent(lineage)}/kb-refresh`;
const useMock = import.meta.env.VITE_USE_MOCK !== "false";

function mapStatus(value: BackendRefresh): KnowledgeRefreshStatus {
  return {
    available: value.available,
    networkId: value.network_id ?? "",
    state: value.state,
    reason: value.reason ?? "",
    revision: value.revision,
    canManage: value.can_manage,
    canRelease: value.can_release,
    canDiscard: value.can_discard,
    files: value.files,
    changed: value.changed,
    removed: value.removed,
    reused: value.reused,
    completed: value.completed,
    pendingLinks: value.pending_links,
    pendingFields: value.pending_fields,
    pendingFacts: value.pending_facts,
    estimatedMillis: value.estimate?.duration_millis ?? null,
    reviewReasons: value.estimate?.reasons ?? [],
    updateTime: value.update_time,
    limits: {
      changedPercent: value.limits.max_changed_percent,
      removedPercent: value.limits.max_removed_percent,
      durationMillis: value.limits.max_duration_millis,
    },
  };
}

/** Reads status only. A missing extension/current document publication is absent. */
export async function getKnowledgeRefresh(lineage: string): Promise<KnowledgeRefreshStatus | null> {
  if (useMock) return null;
  try {
    const response = await http.get<BackendRefresh>(path(lineage), { skipErrorToast: true });
    return response.data.available ? mapStatus(response.data) : null;
  } catch (error) {
    if (axios.isAxiosError(error) && [404, 409].includes(error.response?.status ?? 0)) return null;
    throw error;
  }
}

/** Commands use server-confirmed permissions and an exact observed target/revision. */
export async function commandKnowledgeRefresh(
  lineage: string,
  action: "check" | "release" | "discard",
  status: Pick<KnowledgeRefreshStatus, "networkId" | "revision">,
): Promise<KnowledgeRefreshStatus> {
  const response = await http.post<BackendRefresh>(
    path(lineage),
    { action, network_id: status.networkId, revision: status.revision },
    { skipErrorToast: true },
  );
  return mapStatus(response.data);
}
