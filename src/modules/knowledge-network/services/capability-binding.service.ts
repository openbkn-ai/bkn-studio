/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import {
  mapCapabilityBinding,
  mapCapabilityBindingsList,
} from "@/modules/knowledge-network/services/mappers";
import { toBackendAttachEntry } from "@/modules/knowledge-network/services/mappers/capability.mapper";
import type {
  BackendCapabilityBindingsList,
} from "@/modules/knowledge-network/services/mappers/capability.mapper";
import { DEFAULT_KNOWLEDGE_NETWORK_BRANCH } from "@/modules/knowledge-network/services/mappers/network.mapper";
import {
  attachMockCapabilities,
  detachMockCapabilities,
  listMockCapabilities,
} from "@/modules/knowledge-network/services/mock/state";
import { useMock, wait } from "@/modules/knowledge-network/services/shared/runtime";
import type {
  AttachCapabilityInput,
  CapabilityBindingListQuery,
  CapabilityBindingListResult,
  CapabilityBindingRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

const CAPABILITY_LIST_DEFAULT_LIMIT = 20;

function capabilitiesPath(networkId: string) {
  return `/bkn-backend/v1/knowledge-networks/${networkId}/capabilities`;
}

export async function listKnowledgeNetworkCapabilities(
  networkId: string,
  query: CapabilityBindingListQuery = {},
): Promise<CapabilityBindingListResult> {
  if (useMock) {
    return wait(listMockCapabilities(networkId, query));
  }

  const response = await http.get<BackendCapabilityBindingsList>(
    capabilitiesPath(networkId),
    {
      params: {
        box_id: query.boxId || undefined,
        branch: DEFAULT_KNOWLEDGE_NETWORK_BRANCH,
        direction: query.direction ?? "desc",
        limit: query.limit ?? CAPABILITY_LIST_DEFAULT_LIMIT,
        offset: query.offset ?? 0,
        sort: query.sort ?? "create_time",
        type: query.type,
        with_detail: query.withDetail ? "true" : undefined,
      },
    },
  );

  return mapCapabilityBindingsList(response.data);
}

/**
 * Mounting is idempotent, so a repeated pick is not an error. A whole-box entry (`allTools`) is
 * expanded server-side into one binding per tool, which is why the response is a list either way.
 */
export async function attachKnowledgeNetworkCapabilities(
  networkId: string,
  inputs: AttachCapabilityInput[],
): Promise<CapabilityBindingRecord[]> {
  if (useMock) {
    return wait(attachMockCapabilities(networkId, inputs));
  }

  const response = await http.post<BackendCapabilityBindingsList>(
    capabilitiesPath(networkId),
    { capabilities: inputs.map(toBackendAttachEntry) },
    { params: { branch: DEFAULT_KNOWLEDGE_NETWORK_BRANCH } },
  );

  return (response.data.entries ?? []).map(mapCapabilityBinding);
}

export async function detachKnowledgeNetworkCapabilities(
  networkId: string,
  bindingIds: string[],
): Promise<void> {
  if (bindingIds.length === 0) {
    return;
  }

  if (useMock) {
    detachMockCapabilities(networkId, bindingIds);
    await wait(null);
    return;
  }

  await http.delete(`${capabilitiesPath(networkId)}/${bindingIds.join(",")}`, {
    params: { branch: DEFAULT_KNOWLEDGE_NETWORK_BRANCH },
  });
}
