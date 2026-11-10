/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  parseContentDispositionFilename,
  triggerBrowserDownload,
} from "@/framework/download/file-download";
import { http } from "@/framework/request/http";
import { createPendingRequest } from "@/framework/request/pending-request";
import i18n from "@/app/locales/i18n";
import { unwrapSingleEntryResponse, type SingleEntryResponse } from "@/framework/request/normalize";
import type {
  CapabilityImportReport,
  KnowledgeNetworkExportFormat,
  KnowledgeNetworkBindingPolicy,
  KnowledgeNetworkImportMode,
  KnowledgeNetworkListQuery,
  KnowledgeNetworkListResult,
  KnowledgeNetworkMutationPayload,
  KnowledgeNetworkRecord,
  KnowledgeNetworkStatistics,
  NetworkCheckResult,
} from "@/modules/knowledge-network/types/knowledge-network";
import type {
  BackendKnowledgeNetwork,
  BackendListResponse,
  BackendObjectType,
} from "@/modules/knowledge-network/services/mappers/backend-types";
import { mapKnowledgeNetwork, mapRecentObject } from "@/modules/knowledge-network/services/mappers";
import {
  toBackendKnowledgeNetworkCreatePayload,
  toBackendKnowledgeNetworkUpdatePayload,
} from "@/modules/knowledge-network/services/mappers/network.mapper";
import {
  MOCK_DECLARED_NETWORK_ID,
  mockClearedDeclarations,
  mockNetworkCheckResult,
} from "@/modules/knowledge-network/services/mock/declaration-refusals";
import {
  mockActionTypes,
  mockConceptGroups,
  mockKnowledgeNetworks,
  mockObjectTypes,
  mockRecentObjects,
  mockRelationTypes,
  replaceMockKnowledgeNetworks,
} from "@/modules/knowledge-network/services/mock/state";
import { knVersionQuery } from "@/modules/knowledge-network/services/shared/kn-version-context";
import {
  downloadJsonFile,
  emptyStatistics,
  filterKnowledgeNetworks,
  formatTimestamp,
  KnowledgeNetworkImportBindingError,
  stringFromUnknown,
  throwImportConflict,
  useMock,
  wait,
} from "@/modules/knowledge-network/services/shared/runtime";
import {
  CONFIRM_CLEAR_DECLARATIONS_PARAM,
  DeclarationsWouldBeClearedError,
  KnowledgeNetworkExportRefusedError,
  parseNetworkCheckResult,
  throwIfDeclarationsWouldBeCleared,
  throwIfExportRefused,
} from "@/modules/knowledge-network/services/shared/declaration-errors";

// Whole-network import and export can outlast the client's 30s default while
// the backend processes a large model. Keep both operations on an explicit
// one-minute request budget without changing the global HTTP timeout.
const KNOWLEDGE_NETWORK_EXPORT_TIMEOUT_MS = 60_000;
const DEFAULT_KNOWLEDGE_NETWORK_IMPORT_TIMEOUT_MS = 60_000;
const configuredKnowledgeNetworkImportTimeout = Number(
  import.meta.env.VITE_KNOWLEDGE_NETWORK_IMPORT_TIMEOUT_MS,
);
const KNOWLEDGE_NETWORK_IMPORT_TIMEOUT_MS =
  Number.isFinite(configuredKnowledgeNetworkImportTimeout) &&
  configuredKnowledgeNetworkImportTimeout > 0
    ? configuredKnowledgeNetworkImportTimeout
    : DEFAULT_KNOWLEDGE_NETWORK_IMPORT_TIMEOUT_MS;

const MOCK_KNOWLEDGE_NETWORK_OPERATIONS = [
  "view_detail",
  "query_data",
  "modify",
  "delete",
  "authorize",
  "execute",
];

const KNOWLEDGE_NETWORK_IMPORT_CONFLICT_ERROR_CODES = new Set([
  "BknBackend.KnowledgeNetwork.KNIDExisted",
  "BknBackend.KnowledgeNetwork.KNNameExisted",
  // Keep recognizing responses from the legacy ontology manager during rollout.
  "OntologyManager.KnowledgeNetwork.KNIDExisted",
  "OntologyManager.KnowledgeNetwork.KNNameExisted",
]);

const KNOWLEDGE_NETWORK_IMPORT_BINDING_ERROR_CODE =
  "BknBackend.KnowledgeNetwork.Proxy.TargetInvalid";

export async function listKnowledgeNetworks(
  query: KnowledgeNetworkListQuery,
): Promise<KnowledgeNetworkListResult> {
  if (useMock) {
    const filtered = filterKnowledgeNetworks(mockKnowledgeNetworks, query);
    const startIndex = (query.page - 1) * query.pageSize;

    return wait({
      items: filtered.slice(startIndex, startIndex + query.pageSize),
      total: filtered.length,
    });
  }

  const response = await http.get<BackendListResponse<BackendKnowledgeNetwork>>(
    "/bkn-backend/v1/knowledge-networks",
    {
      params: {
        direction: query.direction === "asc" ? "asc" : "desc",
        limit: query.pageSize,
        name_pattern: query.keyword.trim() || undefined,
        offset: (query.page - 1) * query.pageSize,
        sort: query.sortBy === "name" ? "name" : "update_time",
        tag: query.tag || undefined,
      },
    },
  );

  return {
    items: response.data.entries.map(mapKnowledgeNetwork),
    total: response.data.total_count,
  };
}

export async function listKnowledgeNetworkTags() {
  if (useMock) {
    return wait([...new Set(mockKnowledgeNetworks.flatMap((item) => item.tags))].sort());
  }

  const pageSize = 200;
  const tagSet = new Set<string>();
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const response = await http.get<BackendListResponse<BackendKnowledgeNetwork>>(
      "/bkn-backend/v1/knowledge-networks",
      {
        params: {
          limit: pageSize,
          offset,
          sort: "update_time",
          direction: "desc",
        },
      },
    );
    const entries = response.data.entries;
    entries.forEach((item) => {
      (item.tags ?? []).forEach((tag) => tagSet.add(tag));
    });
    offset += entries.length;
    hasMore = entries.length === pageSize && offset < response.data.total_count;
  }

  return [...tagSet].sort((left, right) => left.localeCompare(right));
}

const pendingNetwork = createPendingRequest<KnowledgeNetworkRecord | null>();
const pendingStatistics = createPendingRequest<KnowledgeNetworkStatistics | null>();

export async function getKnowledgeNetwork(
  networkId: string,
  options: { skipErrorToast?: boolean } = {},
) {
  if (useMock) {
    return wait(mockKnowledgeNetworks.find((item) => item.id === networkId) ?? null);
  }

  return pendingNetwork(JSON.stringify([networkId, Boolean(options.skipErrorToast)]), async () => {
    const response = await http.get<SingleEntryResponse<BackendKnowledgeNetwork>>(
      `/bkn-backend/v1/knowledge-networks/${networkId}`,
      {
        skipErrorToast: options.skipErrorToast,
      },
    );

    const record = unwrapSingleEntryResponse(response.data);
    return record ? mapKnowledgeNetwork(record) : null;
  });
}

/** Loads navigation counts independently so workspace content is not blocked by statistics. */
export async function getKnowledgeNetworkStatistics(
  networkId: string,
): Promise<KnowledgeNetworkStatistics | null> {
  if (useMock) {
    return wait(mockKnowledgeNetworks.find((item) => item.id === networkId)?.statistics ?? null);
  }

  return pendingStatistics(networkId, async () => {
    const response = await http.get<SingleEntryResponse<BackendKnowledgeNetwork>>(
      `/bkn-backend/v1/knowledge-networks/${networkId}`,
      {
        params: { detail_level: "summary", include_statistics: true },
      },
    );
    const record = unwrapSingleEntryResponse(response.data);
    return record ? mapKnowledgeNetwork(record).statistics : null;
  });
}

export async function createKnowledgeNetwork(input: KnowledgeNetworkMutationPayload) {
  if (useMock) {
    const nextRecord: KnowledgeNetworkRecord = {
      id: crypto.randomUUID(),
      identifier: input.identifier,
      name: input.name,
      description: input.description,
      color: input.color,
      icon: "deployment-unit",
      operations: MOCK_KNOWLEDGE_NETWORK_OPERATIONS,
      tags: input.tags,
      createTime: formatTimestamp(Date.now()),
      updateTime: formatTimestamp(Date.now()),
      creatorName: "Local Admin",
      updaterName: "Local Admin",
      statistics: emptyStatistics(),
    };

    mockKnowledgeNetworks.unshift(nextRecord);
    mockRecentObjects[nextRecord.id] = [];
    mockConceptGroups[nextRecord.id] = [];
    mockObjectTypes[nextRecord.id] = [];
    mockRelationTypes[nextRecord.id] = [];
    mockActionTypes[nextRecord.id] = [];

    await wait(undefined);
    return nextRecord;
  }

  const response = await http.post<{ id: string }>(
    "/bkn-backend/v1/knowledge-networks",
    toBackendKnowledgeNetworkCreatePayload(input),
    {
      params: {
        validate_dependency: false,
      },
    },
  );

  return getKnowledgeNetwork(response.data.id);
}

export async function updateKnowledgeNetwork(
  networkId: string,
  input: KnowledgeNetworkMutationPayload,
) {
  if (useMock) {
    replaceMockKnowledgeNetworks(
      mockKnowledgeNetworks.map((item) =>
        item.id === networkId
          ? {
              ...item,
              identifier: input.identifier,
              name: input.name,
              description: input.description,
              color: input.color,
              tags: input.tags,
              updateTime: formatTimestamp(Date.now()),
              updaterName: "Local Admin",
            }
          : item,
      ),
    );

    await wait(undefined);
    return mockKnowledgeNetworks.find((item) => item.id === networkId) ?? null;
  }

  await http.put(
    `/bkn-backend/v1/knowledge-networks/${networkId}`,
    toBackendKnowledgeNetworkUpdatePayload(input),
    {
      params: {
        validate_dependency: false,
      },
    },
  );

  return getKnowledgeNetwork(networkId);
}

export async function deleteKnowledgeNetwork(networkId: string) {
  if (useMock) {
    replaceMockKnowledgeNetworks(mockKnowledgeNetworks.filter((item) => item.id !== networkId));
    delete mockRecentObjects[networkId];
    delete mockConceptGroups[networkId];
    delete mockObjectTypes[networkId];
    delete mockRelationTypes[networkId];
    delete mockActionTypes[networkId];
    await wait(undefined);
    return;
  }

  await http.delete(`/bkn-backend/v1/knowledge-networks/${networkId}`);
}

export async function listKnowledgeNetworkRecentObjects(networkId: string) {
  if (useMock) {
    return wait(mockRecentObjects[networkId] ?? []);
  }

  const response = await http.get<BackendListResponse<BackendObjectType>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/object-types`,
    {
      params: {
        direction: "desc",
        limit: 5,
        offset: 0,
        sort: "update_time",
      },
    },
  );

  return response.data.entries.map(mapRecentObject);
}

export type KnowledgeNetworkExportOptions = {
  /**
   * `2.0` writes a 2.x BKN package, which leaves BKN spec 3.0 declarations out. Left out, the
   * backend writes 3.0 for a network holding a declaration only 3.0 can carry, and 2.x otherwise.
   */
  bknSpec?: "2.0";
};

/**
 * Downloads a network as a JSON export or a BKN package. A 3.0 package the backend refuses to
 * write rejects with `KnowledgeNetworkExportRefusedError`; errors are not toasted here, the caller
 * shows them.
 */
export async function exportKnowledgeNetwork(
  networkId: string,
  format: KnowledgeNetworkExportFormat = "json",
  options: KnowledgeNetworkExportOptions = {},
) {
  if (useMock) {
    const record = mockKnowledgeNetworks.find((item) => item.id === networkId);
    if (!record) {
      throw new Error("Knowledge network not found");
    }

    if (format === "bkn" && !options.bknSpec && networkId === MOCK_DECLARED_NETWORK_ID) {
      await wait(undefined);
      throw new KnowledgeNetworkExportRefusedError(
        "BknBackend.KnowledgeNetwork.ExportNeedsNetworkCheck",
        { check: mockNetworkCheckResult, kind: "network_check" },
      );
    }

    // The BKN package is assembled by the backend, so mock mode can only ever
    // hand back the JSON view of the same network.
    downloadJsonFile(record.name, {
      id: record.id,
      code: record.identifier,
      name: record.name,
      comment: record.description,
      color: record.color,
      tags: record.tags,
    });
    return;
  }

  try {
    if (format === "bkn") {
      // A versioned network exports the version on screen, not always the running one.
      const exportParams = {
        ...(options.bknSpec ? { bkn_spec: options.bknSpec } : {}),
        ...knVersionQuery(networkId),
      };
      const response = await http.get<Blob>(`/bkn-backend/v1/bkns/${networkId}`, {
        ...(Object.keys(exportParams).length > 0 ? { params: exportParams } : {}),
        responseType: "blob",
        skipErrorToast: true,
        timeout: KNOWLEDGE_NETWORK_EXPORT_TIMEOUT_MS,
      });

      triggerBrowserDownload(
        response.data,
        parseContentDispositionFilename(
          response.headers["content-disposition"] as string | undefined,
        ) ?? `${networkId}.tar`,
      );
      return;
    }

    const response = await http.get<Blob>(`/bkn-backend/v1/knowledge-networks/${networkId}`, {
      params: { mode: "export" },
      responseType: "blob",
      skipErrorToast: true,
      timeout: KNOWLEDGE_NETWORK_EXPORT_TIMEOUT_MS,
    });

    triggerBrowserDownload(
      response.data,
      parseContentDispositionFilename(
        response.headers["content-disposition"] as string | undefined,
      ) ?? `${networkId}.json`,
    );
  } catch (error) {
    throwIfExportRefused(error);
    throw error;
  }
}

/**
 * Runs the network check: the action type and logic property parameters whose value source
 * execution drops and a 3.0 export refuses. It reads definitions only, on any network, 2.x
 * included, and changes nothing.
 */
export async function checkKnowledgeNetwork(networkId: string): Promise<NetworkCheckResult> {
  if (useMock) {
    return wait(
      networkId === MOCK_DECLARED_NETWORK_ID
        ? mockNetworkCheckResult
        : { invalidParameters: [], misplacedParameters: [] },
    );
  }

  const response = await http.get<unknown>(`/bkn-backend/v1/bkns/${networkId}/check`, {
    skipErrorToast: true,
  });
  return parseNetworkCheckResult(response.data);
}

/** Sent only once the user confirmed, so an unconfirmed import sends what it always has. */
function confirmClearDeclarationsParam(confirmClearDeclarations: boolean) {
  return confirmClearDeclarations ? { [CONFIRM_CLEAR_DECLARATIONS_PARAM]: true } : {};
}

/** Mock mode refuses an unconfirmed overwrite of the network that holds declarations. */
async function refuseMockOverwrite(
  identifier: string,
  importMode: KnowledgeNetworkImportMode,
  confirmClearDeclarations: boolean,
) {
  if (
    importMode === "overwrite" &&
    !confirmClearDeclarations &&
    identifier === MOCK_DECLARED_NETWORK_ID
  ) {
    await wait(undefined);
    throw new DeclarationsWouldBeClearedError(
      "BknBackend.ObjectType.DeclarationsWouldBeCleared",
      mockClearedDeclarations,
    );
  }
}

export async function importKnowledgeNetwork(
  payload: Record<string, unknown>,
  importMode: KnowledgeNetworkImportMode = "normal",
  bindingPolicy: KnowledgeNetworkBindingPolicy = "preserve",
  strictMode = false,
  confirmClearDeclarations = false,
) {
  if (useMock) {
    const identifier = stringFromUnknown(
      payload.id,
      stringFromUnknown(payload.code, crypto.randomUUID()),
    );
    await refuseMockOverwrite(identifier, importMode, confirmClearDeclarations);
    const exists = mockKnowledgeNetworks.some(
      (item) => item.id === identifier || item.identifier === identifier,
    );

    if (exists && importMode === "normal") {
      throwImportConflict(i18n.t("knowledgeNetwork.networkIdOrNameExists"));
    }

    if (exists && importMode === "ignore") {
      await wait(undefined);
      return;
    }

    const nextRecord: KnowledgeNetworkRecord = {
      id: identifier,
      identifier: stringFromUnknown(payload.code, identifier),
      name: stringFromUnknown(payload.name, identifier),
      description: stringFromUnknown(payload.comment, stringFromUnknown(payload.description)),
      color: stringFromUnknown(payload.color, "#1677ff"),
      icon: stringFromUnknown(payload.icon, "deployment-unit"),
      operations: MOCK_KNOWLEDGE_NETWORK_OPERATIONS,
      tags: Array.isArray(payload.tags) ? (payload.tags as string[]) : [],
      createTime: formatTimestamp(Date.now()),
      updateTime: formatTimestamp(Date.now()),
      creatorName: "Imported User",
      updaterName: "Imported User",
      statistics: emptyStatistics(),
    };

    if (exists && importMode === "overwrite") {
      replaceMockKnowledgeNetworks(
        mockKnowledgeNetworks.map((item) => (item.id === identifier ? nextRecord : item)),
      );
    } else {
      mockKnowledgeNetworks.unshift(nextRecord);
    }

    await wait(undefined);
    return;
  }

  try {
    await http.post("/bkn-backend/v1/knowledge-networks", payload, {
      params: {
        binding_policy: bindingPolicy,
        import_mode: importMode,
        strict_mode: strictMode,
        ...confirmClearDeclarationsParam(confirmClearDeclarations),
      },
      skipErrorToast: true,
      timeout: KNOWLEDGE_NETWORK_IMPORT_TIMEOUT_MS,
    });
  } catch (error) {
    rethrowImportError(error);
  }
}

/**
 * Reads bkn-backend's refusal of a network import, from a JSON body or a BKN package alike: a
 * declaration the overwrite would clear becomes `DeclarationsWouldBeClearedError`, a name or id
 * already in use becomes a conflict the dialog resolves, an invalid binding target keeps its
 * details, and anything else is rethrown as is.
 */
function rethrowImportError(error: unknown): never {
  throwIfDeclarationsWouldBeCleared(error);

  const response = (
    error as {
      response?: {
        data?: {
          error_code?: string;
          description?: string;
          error_details?: string;
        };
      };
    }
  ).response?.data;
  const { description, error_code: errorCode, error_details: details } = response ?? {};

  if (KNOWLEDGE_NETWORK_IMPORT_CONFLICT_ERROR_CODES.has(errorCode ?? "")) {
    throwImportConflict(
      description?.trim() || errorCode || i18n.t("knowledgeNetwork.importConflictTitle"),
    );
  }

  if (errorCode === KNOWLEDGE_NETWORK_IMPORT_BINDING_ERROR_CODE) {
    throw new KnowledgeNetworkImportBindingError(
      description?.trim() || errorCode || i18n.t("knowledgeNetwork.importBindingInvalidTitle"),
      details,
    );
  }

  throw error;
}

/** File names bkn-backend reads as a BKN package: a tar archive, gzipped or not, or a zip. */
const KNOWLEDGE_NETWORK_PACKAGE_SUFFIXES = [".tar", ".tar.gz", ".tgz", ".zip"];

export function isKnowledgeNetworkPackage(fileName: string) {
  const lower = fileName.toLowerCase();
  return KNOWLEDGE_NETWORK_PACKAGE_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

type BackendCapabilityImportReport = {
  bound?: number;
  skipped?: Array<{
    box_name?: string;
    capability_type?: string;
    name?: string;
    reason?: string;
  }> | null;
};

export function mapCapabilityImportReport(
  report: BackendCapabilityImportReport | null | undefined,
): CapabilityImportReport {
  return {
    bound: report?.bound ?? 0,
    skipped: (report?.skipped ?? []).map((skip) => ({
      boxName: skip.box_name ?? "",
      capabilityType: skip.capability_type ?? "",
      name: skip.name ?? "",
      reason: skip.reason ?? "",
    })),
  };
}

/**
 * Imports a BKN package (`POST /bkns`), the format studio exports. Unlike a JSON import it also
 * mounts the capabilities the package declares, and replies what it could not mount and why.
 */
export async function importKnowledgeNetworkPackage(
  file: File,
  importMode: KnowledgeNetworkImportMode = "normal",
  bindingPolicy: KnowledgeNetworkBindingPolicy = "preserve",
  strictMode = false,
  confirmClearDeclarations = false,
): Promise<CapabilityImportReport> {
  if (useMock) {
    const identifier = file.name.replace(/\.(tar\.gz|tgz|tar|zip)$/i, "");
    await refuseMockOverwrite(identifier, importMode, confirmClearDeclarations);
    if (!mockKnowledgeNetworks.some((item) => item.id === identifier)) {
      mockKnowledgeNetworks.unshift({
        color: "#1677ff",
        createTime: formatTimestamp(Date.now()),
        creatorName: "Imported User",
        description: "",
        icon: "deployment-unit",
        id: identifier,
        identifier,
        name: identifier,
        operations: MOCK_KNOWLEDGE_NETWORK_OPERATIONS,
        statistics: emptyStatistics(),
        tags: [],
        updateTime: formatTimestamp(Date.now()),
        updaterName: "Imported User",
      });
    }
    // A package from another environment: one knowledge base and one skill could not be bound.
    return wait(
      mapCapabilityImportReport(
        bindingPolicy === "detach"
          ? { bound: 0, skipped: [] }
          : {
              bound: 3,
              skipped: [
                { capability_type: "knowledge_base", name: "Contracts", reason: "ambiguous_name" },
                { capability_type: "skill", name: "delivery-risk", reason: "not_found" },
              ],
            },
      ),
    );
  }

  const form = new FormData();
  form.append("file", file);
  try {
    const response = await http.post<{ capabilities?: BackendCapabilityImportReport | null }>(
      "/bkn-backend/v1/bkns",
      form,
      {
        params: {
          binding_policy: bindingPolicy,
          import_mode: importMode,
          strict_mode: strictMode,
          ...confirmClearDeclarationsParam(confirmClearDeclarations),
        },
        skipErrorToast: true,
        timeout: KNOWLEDGE_NETWORK_IMPORT_TIMEOUT_MS,
      },
    );
    return mapCapabilityImportReport(response.data?.capabilities);
  } catch (error) {
    rethrowImportError(error);
  }
}
