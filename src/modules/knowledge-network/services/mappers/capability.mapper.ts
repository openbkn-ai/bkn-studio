/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  AttachCapabilityInput,
  CapabilitySource,
  CapabilitySourceKind,
  CapabilityBindingListResult,
  CapabilityBindingRecord,
  CapabilityBoxSummary,
  CapabilityType,
} from "@/modules/knowledge-network/types/knowledge-network";
import type { BackendAccountInfo } from "@/modules/knowledge-network/services/mappers/backend-types";
import { formatTimestamp } from "@/modules/knowledge-network/services/shared/runtime";

/**
 * The wire name of the owning container is `box_id` on every surface — execution factory, Context
 * Loader and Studio all call it that — even though the backend column stays type-neutral.
 */
export type BackendCapabilitySource = {
  kind?: string;
  refs?: Array<{ id?: string; name?: string; property?: string }>;
};

export type BackendCapabilityBinding = {
  bound_as_box?: boolean;
  box_id?: string;
  branch?: string;
  capability_id?: string;
  capability_type?: string;
  comment?: string;
  create_time?: number;
  creator?: BackendAccountInfo;
  description?: string;
  id?: string;
  kn_id?: string;
  metadata_type?: string;
  name?: string;
  owner_name?: string;
  sources?: BackendCapabilitySource[];
  status?: string;
  update_time?: number;
  updater?: BackendAccountInfo;
};

export type BackendCapabilityBoxSummary = {
  box_id?: string;
  box_missing?: boolean;
  box_name?: string;
  mounted_tools?: number;
  total_tools?: number;
  unmounted_tools?: number;
};

export type BackendCapabilityBindingsList = {
  boxes?: BackendCapabilityBoxSummary[];
  entries?: BackendCapabilityBinding[];
  metadata_available?: boolean;
  total_count?: number;
};

export type BackendAttachCapabilityEntry = {
  all_tools?: boolean;
  box_id?: string;
  capability_id?: string;
  capability_type: string;
  comment?: string;
};

const CAPABILITY_SOURCE_KINDS: CapabilitySourceKind[] = [
  "action_type",
  "box",
  "manual",
  "object_type",
];

/** An unknown kind is dropped rather than guessed: a wrong source would misstate who owns a row. */
function mapCapabilitySources(
  items: BackendCapabilitySource[] | undefined,
): CapabilitySource[] {
  return (items ?? []).reduce<CapabilitySource[]>((sources, item) => {
    const kind = CAPABILITY_SOURCE_KINDS.find((known) => known === item.kind);
    if (!kind) {
      return sources;
    }

    sources.push({
      kind,
      refs: (item.refs ?? []).map((ref) => ({
        id: ref.id ?? "",
        name: ref.name ?? ref.id ?? "",
        property: ref.property,
      })),
    });

    return sources;
  }, []);
}

function mapCapabilityType(value: string | undefined): CapabilityType {
  switch (value) {
    case "function":
      return "function";
    case "mcp_tool":
      return "mcp_tool";
    default:
      return "skill";
  }
}

export function mapCapabilityBinding(
  item: BackendCapabilityBinding,
): CapabilityBindingRecord {
  return {
    boundAsBox: item.bound_as_box ?? false,
    boxId: item.box_id ?? "",
    boxName: item.owner_name ?? "",
    branch: item.branch ?? "",
    capabilityId: item.capability_id ?? "",
    capabilityType: mapCapabilityType(item.capability_type),
    comment: item.comment ?? "",
    createTime: formatTimestamp(item.create_time),
    creatorName: item.creator?.name ?? item.creator?.id ?? "-",
    description: item.description ?? "",
    id: item.id ?? "",
    metadataType:
      item.metadata_type === "openapi" || item.metadata_type === "function"
        ? item.metadata_type
        : "",
    name: item.name ?? "",
    sources: mapCapabilitySources(item.sources),
    status: item.status ?? "",
    updateTime: formatTimestamp(item.update_time),
    updaterName: item.updater?.name ?? item.updater?.id ?? "-",
  };
}

export function mapCapabilityBoxSummary(
  item: BackendCapabilityBoxSummary,
): CapabilityBoxSummary {
  return {
    boxId: item.box_id ?? "",
    boxMissing: item.box_missing ?? false,
    boxName: item.box_name ?? "",
    mountedTools: item.mounted_tools ?? 0,
    totalTools: item.total_tools ?? 0,
    unmountedTools: item.unmounted_tools ?? 0,
  };
}

export function mapCapabilityBindingsList(
  payload: BackendCapabilityBindingsList,
): CapabilityBindingListResult {
  const entries = (payload.entries ?? []).map(mapCapabilityBinding);

  return {
    boxes: (payload.boxes ?? []).map(mapCapabilityBoxSummary),
    entries,
    // Absent flag means the field was not sent at all; the bindings themselves are still valid,
    // so treat metadata as available rather than warning about an outage that did not happen.
    metadataAvailable: payload.metadata_available ?? true,
    totalCount: payload.total_count ?? entries.length,
  };
}

export function toBackendAttachEntry(
  input: AttachCapabilityInput,
): BackendAttachCapabilityEntry {
  return {
    all_tools: input.allTools ?? undefined,
    box_id: input.boxId || undefined,
    capability_id: input.capabilityId || undefined,
    capability_type: input.capabilityType,
    comment: input.comment || undefined,
  };
}
