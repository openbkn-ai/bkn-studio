/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { isRequestNotFound } from "@/framework/request/error-message";
import { http } from "@/framework/request/http";
import { defaultDevRuntimeUser } from "@/framework/runtime/dev-profile";
import {
  type BackendLogicNeed,
  type BackendRequirements,
  getRequirements,
  mapLogicNeed,
  mapRequirements,
  reviewRequirements,
} from "@/modules/bkn-project/services/requirements.service";
import type {
  LogicNeedCandidate,
  LogicNeedCandidates,
  LogicNeedImplementation,
  LogicNeedLink,
  LogicNeeds,
  LogicNeedTarget,
} from "@/modules/bkn-project/types/kinetic";
import type { Requirements } from "@/modules/bkn-project/types/requirements";

const useMock = import.meta.env.VITE_USE_MOCK !== "false";

const logicNeedsPath = (projectId: string) =>
  `/bkn-project/v1/projects/${encodeURIComponent(projectId)}/requirements/logic-needs`;

const needPath = (projectId: string, needId: string) =>
  `${logicNeedsPath(projectId)}/${encodeURIComponent(needId)}`;

/* ------------------------------- Backend shapes ------------------------------- */

type BackendLink = {
  at?: number;
  box_id?: string;
  by?: { id: string } | null;
  id: string;
  type: string;
};

type BackendImplementation = {
  available?: boolean;
  description?: string;
  name?: string;
  owner_object_type_id?: string;
  owner_object_type_name?: string;
  reason?: string;
  status?: string;
  version?: string;
};

type BackendLogicNeeds = {
  needs?:
    | (BackendLogicNeed & {
        implementation?: BackendImplementation | null;
        link?: BackendLink | null;
        live_object_type_ids?: string[] | null;
        unconnected?: { from: string; to: string }[] | null;
      })[]
    | null;
  network_id?: string;
  network_items?:
    | {
        box_id?: string;
        description?: string;
        id: string;
        /** The kind of need it implements; an older bkn-project leaves it to the type. */
        kind?: string;
        name: string;
        need_ids?: string[] | null;
        owner_object_type_id?: string;
        owner_object_type_name?: string;
        type: string;
      }[]
    | null;
  network_items_reason?: string;
  reason?: string;
  live?: boolean;
  released?: boolean;
  update_time: number;
};

type BackendCandidates = {
  candidates?:
    | {
        box_id?: string;
        description?: string;
        id: string;
        name: string;
        owner_object_type_id?: string;
        reasons?: string[] | null;
        type: string;
      }[]
    | null;
  network_id?: string;
  reason?: string;
};

const mapLink = (link: BackendLink): LogicNeedLink => ({
  at: link.at ?? 0,
  boxId: link.box_id ?? "",
  byId: link.by?.id ?? "",
  id: link.id,
  type: link.type,
});

const mapImplementation = (implementation: BackendImplementation): LogicNeedImplementation => ({
  available: implementation.available ?? false,
  description: implementation.description ?? "",
  name: implementation.name ?? "",
  ownerObjectTypeId: implementation.owner_object_type_id ?? "",
  ownerObjectTypeName: implementation.owner_object_type_name ?? "",
  reason: implementation.reason ?? "",
  status: implementation.status ?? "",
  version: implementation.version ?? "",
});

export const mapLogicNeeds = (data: BackendLogicNeeds): LogicNeeds => ({
  needs: (data.needs ?? []).map((need) => ({
    ...mapLogicNeed(need),
    implementation: need.implementation ? mapImplementation(need.implementation) : null,
    link: need.link ? mapLink(need.link) : null,
    liveObjectTypeIds: need.live_object_type_ids ?? [],
    unconnected: (need.unconnected ?? []).map(({ from, to }) => ({ from, to })),
  })),
  networkId: data.network_id ?? "",
  networkItems: (data.network_items ?? []).map((item) => ({
    boxId: item.box_id ?? "",
    description: item.description ?? "",
    id: item.id,
    kind: item.kind || (item.type === "object_metric" ? "metric" : item.type),
    name: item.name,
    needIds: item.need_ids ?? [],
    ownerObjectTypeId: item.owner_object_type_id ?? "",
    ownerObjectTypeName: item.owner_object_type_name ?? "",
    type: item.type,
  })),
  networkItemsReason: data.network_items_reason ?? "",
  // An older bkn-project tells only whether the project was released.
  live: data.live ?? data.released ?? false,
  reason: data.reason ?? "",
  released: data.released ?? false,
  updateTime: data.update_time,
});

export const mapCandidates = (data: BackendCandidates): LogicNeedCandidates => ({
  candidates: (data.candidates ?? []).map((candidate) => ({
    boxId: candidate.box_id ?? "",
    description: candidate.description ?? "",
    id: candidate.id,
    name: candidate.name,
    ownerObjectTypeId: candidate.owner_object_type_id ?? "",
    reasons: candidate.reasons ?? [],
    type: candidate.type,
  })),
  networkId: data.network_id ?? "",
  reason: data.reason ?? "",
});

/* ------------------------------------ API ------------------------------------ */

/** The kinetic needs with what implements them, read live from the project's live network. */
export async function getLogicNeeds(projectId: string): Promise<LogicNeeds> {
  if (useMock) {
    return mockLogicNeeds(projectId);
  }
  try {
    const response = await http.get<BackendLogicNeeds>(logicNeedsPath(projectId), {
      skipErrorToast: true,
    });
    return mapLogicNeeds(response.data);
  } catch (error) {
    // An older bkn-project answers 404 before there is a specification: nothing, never released.
    if (isRequestNotFound(error)) {
      return {
        live: false,
        needs: [],
        networkId: "",
        networkItems: [],
        networkItemsReason: "",
        reason: "",
        released: false,
        updateTime: 0,
      };
    }
    throw error;
  }
}

/** What in the live network a need could link to, the likeliest first; a person chooses. */
export async function getLogicNeedCandidates(
  projectId: string,
  needId: string,
): Promise<LogicNeedCandidates> {
  if (useMock) {
    const requirements = await getRequirements(projectId);
    const need = requirements?.spec.logicNeeds.find((item) => item.id === needId);
    return {
      candidates: need ? (MOCK_CANDIDATES[need.kind] ?? []) : [],
      networkId: MOCK_NETWORK,
      reason: "",
    };
  }
  const response = await http.get<BackendCandidates>(`${needPath(projectId, needId)}/candidates`, {
    skipErrorToast: true,
  });
  return mapCandidates(response.data);
}

/** Links a need to an implementation of the live network, on the specification read at `updateTime`. */
export async function linkLogicNeed(
  projectId: string,
  needId: string,
  target: LogicNeedTarget,
  updateTime: number,
): Promise<Requirements> {
  if (useMock) {
    // Linking accepts the need, as bkn-project does; the review also checks the update time.
    const next = await reviewRequirements(projectId, updateTime, [
      { id: needId, kind: "logic_needs" },
    ]);
    mockLinks[needId] = { ...target, at: Date.now(), byId: mockUser };
    return next;
  }
  const response = await http.put<BackendRequirements>(
    `${needPath(projectId, needId)}/link`,
    { box_id: target.boxId, id: target.id, type: target.type, update_time: updateTime },
    { skipErrorToast: true },
  );
  return mapRequirements(response.data);
}

export async function unlinkLogicNeed(
  projectId: string,
  needId: string,
  updateTime: number,
): Promise<Requirements> {
  if (useMock) {
    const next = await reviewRequirements(projectId, updateTime, []);
    delete mockLinks[needId];
    return next;
  }
  const response = await http.delete<BackendRequirements>(`${needPath(projectId, needId)}/link`, {
    params: { update_time: updateTime },
    skipErrorToast: true,
  });
  return mapRequirements(response.data);
}

/* ----------------------------- Mock (local development) ----------------------------- */

const mockUser = defaultDevRuntimeUser.id ?? "mock-user";
const MOCK_NETWORK = "supply_chain";
/** The object types the mock's live network has: the bill of materials waits for a release. */
const MOCK_LIVE = ["sales_orders", "customers"];

const MOCK_CANDIDATES: Record<string, LogicNeedCandidate[]> = {
  action_type: [
    {
      boxId: "",
      description: "Changes the promised date of an order.",
      id: "reschedule_order",
      name: "Reschedule order",
      ownerObjectTypeId: "sales_orders",
      reasons: ["same_name", "same_object_type"],
      type: "action_type",
    },
  ],
  metric: [
    {
      boxId: "",
      description: "Orders shipped after their promised date, over all orders.",
      id: "late_rate",
      name: "Late rate",
      ownerObjectTypeId: "sales_orders",
      reasons: ["similar_name", "same_object_type"],
      type: "object_metric",
    },
  ],
  skill: [
    {
      boxId: "",
      description: "Sorts orders by urgency.",
      id: "order_triage",
      name: "Order triage",
      ownerObjectTypeId: "",
      reasons: ["similar_name"],
      type: "skill",
    },
  ],
};

/** What the mock links, by need: the action type points at one the live network no longer has. */
const mockLinks: Record<string, LogicNeedLink> = {
  n3: {
    at: Date.parse("2026-10-28T09:00:00Z"),
    boxId: "",
    byId: mockUser,
    id: "gone",
    type: "action_type",
  },
};

function mockImplementation(link: LogicNeedLink): LogicNeedImplementation {
  const found = Object.values(MOCK_CANDIDATES)
    .flat()
    .find((candidate) => candidate.type === link.type && candidate.id === link.id);
  return found
    ? {
        available: true,
        description: found.description,
        name: found.name,
        ownerObjectTypeId: found.ownerObjectTypeId,
        ownerObjectTypeName: found.ownerObjectTypeId,
        reason: "",
        status: link.type === "object_metric" ? "published" : "",
        version: link.type === "object_metric" ? "1" : "",
      }
    : {
        // One implemented from the project page is a new metric or action type the mock trusts.
        available: link.id !== "gone",
        description: "",
        name: link.id === "gone" ? "" : link.id,
        ownerObjectTypeId: "",
        ownerObjectTypeName: "",
        reason: link.id === "gone" ? "missing" : "",
        status: "",
        version: "",
      };
}

async function mockLogicNeeds(projectId: string): Promise<LogicNeeds> {
  const requirements = await getRequirements(projectId);
  const needs = requirements?.spec.logicNeeds ?? [];
  return {
    needs: needs.map((need) => {
      const link = mockLinks[need.id] ?? null;
      return {
        ...need,
        implementation: link ? mockImplementation(link) : null,
        link,
        liveObjectTypeIds: need.objectTypeIds.filter((id) => MOCK_LIVE.includes(id)),
        unconnected: [],
      };
    }),
    networkId: MOCK_NETWORK,
    networkItems: [],
    networkItemsReason: "",
    live: true,
    reason: "",
    released: true,
    updateTime: requirements?.updateTime ?? 0,
  };
}
