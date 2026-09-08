/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import type {
  KnDiffAction,
  KnDiffDefinition,
  KnDiffDefinitionKind,
  KnDiffRequest,
  KnDiffResult,
  ObjectDataStatsRequest,
  ObjectDataStatsResult,
  ObjectDataStatsSide,
} from "@/modules/knowledge-network/types/kn-diff";

const DEFAULT_BRANCH = "main";

type BackendValueChange = {
  old?: string;
  new?: string;
};

type BackendFieldChange = {
  path?: string;
  kind?: string;
  old?: string;
  new?: string;
};

type BackendDefinition = {
  type?: string;
  id?: string;
  action?: string;
  name?: BackendValueChange;
  paired_by?: string;
  base_id?: string;
  target_id?: string;
  changes?: BackendFieldChange[] | null;
};

type BackendDiffResult = {
  base?: { kn_id?: string; branch?: string; name?: string };
  target?: { kn_id?: string; branch?: string; name?: string };
  summary?: { created?: number; updated?: number; deleted?: number; unchanged?: number };
  lineage?: { common_ids?: number; total_ids?: number; related?: boolean };
  network?: BackendDefinition | null;
  entries?: BackendDefinition[] | null;
};

type BackendStatsSide = {
  kn_id?: string;
  branch?: string;
  ot_id?: string;
  ot_name?: string;
  resource_id?: string;
  primary_keys?: string[] | null;
  row_count?: number;
  primary_key_distinct?: number;
  duplicate_keys?: number;
};

type BackendStatsResult = {
  base?: BackendStatsSide;
  target?: BackendStatsSide;
  same_resource?: boolean;
  delta?: { row_count?: number; primary_key_distinct?: number };
};

function toAction(value: string | undefined): KnDiffAction {
  switch (value) {
    case "create":
    case "update":
    case "delete":
    case "skip":
      return value;
    default:
      return "update";
  }
}

function mapDefinition(source: BackendDefinition): KnDiffDefinition {
  return {
    action: toAction(source.action),
    baseId: source.base_id ?? "",
    changes: (source.changes ?? []).map((change) => ({
      kind: toAction(change.kind),
      newValue: change.new ?? "",
      oldValue: change.old ?? "",
      path: change.path ?? "",
    })),
    id: source.id ?? "",
    newName: source.name?.new ?? "",
    oldName: source.name?.old ?? "",
    pairedBy: source.paired_by === "name" ? "name" : "id",
    targetId: source.target_id ?? "",
    type: (source.type ?? "object_type") as KnDiffDefinitionKind,
  };
}

/**
 * Compare two knowledge network branches.
 *
 * Both networks travel in the body: neither of them is the resource being addressed, and the
 * backend authorizes each side on its own.
 */
export async function diffKnowledgeNetworks(request: KnDiffRequest): Promise<KnDiffResult> {
  const response = await http.post<BackendDiffResult>("/bkn-backend/v1/bkns/diff", {
    base: { branch: request.baseBranch ?? DEFAULT_BRANCH, kn_id: request.baseNetworkId },
    fallback_by_name: request.fallbackByName ?? false,
    include_unchanged: request.includeUnchanged ?? false,
    target: { branch: request.targetBranch ?? DEFAULT_BRANCH, kn_id: request.targetNetworkId },
  });

  const payload = response.data ?? {};
  return {
    base: {
      branch: payload.base?.branch ?? DEFAULT_BRANCH,
      name: payload.base?.name ?? "",
      networkId: payload.base?.kn_id ?? request.baseNetworkId,
    },
    entries: (payload.entries ?? []).map(mapDefinition),
    lineage: {
      commonIds: payload.lineage?.common_ids ?? 0,
      related: payload.lineage?.related ?? false,
      totalIds: payload.lineage?.total_ids ?? 0,
    },
    network: payload.network ? mapDefinition(payload.network) : null,
    summary: {
      created: payload.summary?.created ?? 0,
      deleted: payload.summary?.deleted ?? 0,
      unchanged: payload.summary?.unchanged ?? 0,
      updated: payload.summary?.updated ?? 0,
    },
    target: {
      branch: payload.target?.branch ?? DEFAULT_BRANCH,
      name: payload.target?.name ?? "",
      networkId: payload.target?.kn_id ?? request.targetNetworkId,
    },
  };
}

function mapStatsSide(source: BackendStatsSide | undefined, fallbackNetworkId: string): ObjectDataStatsSide {
  return {
    branch: source?.branch ?? DEFAULT_BRANCH,
    // A missing count is not zero. It is reported as absent so the page can say "not counted"
    // rather than draw a bar at zero rows.
    duplicateKeys: source?.duplicate_keys ?? null,
    networkId: source?.kn_id ?? fallbackNetworkId,
    objectTypeId: source?.ot_id ?? "",
    objectTypeName: source?.ot_name ?? "",
    primaryKeyDistinct: source?.primary_key_distinct ?? null,
    primaryKeys: source?.primary_keys ?? [],
    resourceId: source?.resource_id ?? "",
    rowCount: source?.row_count ?? 0,
  };
}

/**
 * Count the data behind one object type on each side.
 *
 * This runs against the customer's own database, so it is called for the object type someone
 * opens rather than for the whole network.
 */
export async function fetchObjectDataStats(
  request: ObjectDataStatsRequest,
): Promise<ObjectDataStatsResult> {
  const response = await http.post<BackendStatsResult>(
    "/bkn-backend/v1/bkns/diff/object-data-stats",
    {
      base: {
        branch: request.baseBranch ?? DEFAULT_BRANCH,
        kn_id: request.baseNetworkId,
        ot_id: request.baseObjectTypeId,
      },
      target: {
        branch: request.targetBranch ?? DEFAULT_BRANCH,
        kn_id: request.targetNetworkId,
        ot_id: request.targetObjectTypeId,
      },
    },
  );

  const payload = response.data ?? {};
  return {
    base: mapStatsSide(payload.base, request.baseNetworkId),
    delta: {
      primaryKeyDistinct: payload.delta?.primary_key_distinct ?? null,
      rowCount: payload.delta?.row_count ?? 0,
    },
    sameResource: payload.same_resource ?? false,
    target: mapStatsSide(payload.target, request.targetNetworkId),
  };
}
