/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { readErrorCode, readErrorDetails } from "@/framework/request/error-message";
import { http } from "@/framework/request/http";
import {
  forgetKnVersionContext,
  recordKnVersioning,
} from "@/modules/knowledge-network/services/shared/kn-version-context";
import { useMock } from "@/modules/knowledge-network/services/shared/runtime";
import type {
  KnDiffResult,
  KnPublishInput,
  KnPublishResult,
  KnResetDraftInput,
  KnVersion,
  KnVersionEvent,
  KnVersionProblem,
  KnVersionStatus,
  KnVersionView,
  KnVersioning,
} from "@/modules/knowledge-network/types/kn-version";

const ERROR_CODE_PREFIX = "BknBackend.KNVersion.";

type ListResponse<T> = { entries?: T[]; total_count?: number };

export type KnVersionPage<T> = { items: T[]; total: number };

function base(networkId: string) {
  return `/bkn-backend/v1/knowledge-networks/${encodeURIComponent(networkId)}`;
}

function idempotencyHeaders() {
  return { "Idempotency-Key": crypto.randomUUID() };
}

function assertBackend() {
  if (useMock) {
    throw new Error("Knowledge network versioning needs a backend.");
  }
}

/** The short error code (`DraftBaseOutdated`, ...) of a versioning error, if it is one. */
export function readKnVersionErrorCode(error: unknown): string | undefined {
  const code = readErrorCode(error);
  return code?.startsWith(ERROR_CODE_PREFIX) ? code.slice(ERROR_CODE_PREFIX.length) : undefined;
}

/** `error_details.problems` of a refused publish or activation. */
export function readKnVersionProblems(error: unknown): KnVersionProblem[] {
  const details = readErrorDetails(error);
  const problems =
    details && typeof details === "object" ? (details as { problems?: unknown }).problems : null;
  return Array.isArray(problems) ? (problems as KnVersionProblem[]) : [];
}

/** Whether the error means somebody else changed what the caller was editing. */
export function isKnVersionConflict(error: unknown) {
  const code = readKnVersionErrorCode(error);
  return (
    code === "DefinitionModified" ||
    code === "DraftRevisionMismatch" ||
    code === "RunningVersionMismatch"
  );
}

export async function getKnVersioning(networkId: string): Promise<KnVersioning> {
  if (useMock) {
    return { enabled: false, full_history: true, previous_version: 0, running_version: 0 };
  }
  const response = await http.get<KnVersioning>(`${base(networkId)}/versioning`, {
    skipErrorToast: true,
  });
  return response.data;
}

export async function enableKnVersioning(
  networkId: string,
  input: { label?: string; notes?: string } = {},
): Promise<KnVersioning> {
  assertBackend();
  const response = await http.post<KnVersioning>(
    `${base(networkId)}/versioning`,
    { label: input.label?.trim() || undefined, notes: input.notes?.trim() || undefined },
    { headers: idempotencyHeaders(), skipErrorToast: true },
  );
  forgetKnVersionContext(networkId);
  // Enabling needs modify, so whoever got here can work on the draft.
  recordKnVersioning(networkId, response.data, ["modify"]);
  return response.data;
}

export async function listKnVersions(
  networkId: string,
  query: { limit?: number; offset?: number; status?: KnVersionStatus[] } = {},
): Promise<KnVersionPage<KnVersion>> {
  if (useMock) {
    return { items: [], total: 0 };
  }
  const response = await http.get<ListResponse<KnVersion>>(`${base(networkId)}/versions`, {
    params: {
      limit: query.limit ?? 100,
      offset: query.offset ?? 0,
      status: query.status?.join(",") || undefined,
    },
    skipErrorToast: true,
  });
  const items = response.data.entries ?? [];
  return { items, total: response.data.total_count ?? items.length };
}

export async function listKnVersionEvents(
  networkId: string,
  query: { limit?: number; offset?: number } = {},
): Promise<KnVersionPage<KnVersionEvent>> {
  if (useMock) {
    return { items: [], total: 0 };
  }
  const response = await http.get<ListResponse<KnVersionEvent>>(
    `${base(networkId)}/versions/events`,
    {
      params: { limit: query.limit ?? 50, offset: query.offset ?? 0 },
      skipErrorToast: true,
    },
  );
  const items = response.data.entries ?? [];
  return { items, total: response.data.total_count ?? items.length };
}

export async function publishKnVersion(
  networkId: string,
  input: KnPublishInput,
): Promise<KnPublishResult> {
  assertBackend();
  const response = await http.post<KnPublishResult>(
    `${base(networkId)}/versions`,
    {
      expected_running_version: input.expectedRunningVersion,
      expected_draft_revision: input.expectedDraftRevision,
      label: input.label?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      allow_outdated_base: input.allowOutdatedBase || undefined,
    },
    { headers: idempotencyHeaders(), skipErrorToast: true },
  );
  forgetKnVersionContext(networkId);
  return response.data;
}

export async function activateKnVersion(
  networkId: string,
  version: number,
  expectedRunningVersion: number,
): Promise<KnVersioning> {
  assertBackend();
  const response = await http.post<KnVersioning>(
    `${base(networkId)}/versions/${version}/activate`,
    { expected_running_version: expectedRunningVersion },
    { headers: idempotencyHeaders(), skipErrorToast: true },
  );
  forgetKnVersionContext(networkId);
  return response.data;
}

/** Professional edition: hide a history version from activation, bring it back, or delete it. */
export async function changeKnVersionStatus(
  networkId: string,
  version: number,
  action: "deprecate" | "restore" | "purge",
): Promise<void> {
  assertBackend();
  await http.post(
    `${base(networkId)}/versions/${version}/${action}`,
    {},
    { headers: idempotencyHeaders(), skipErrorToast: true },
  );
  forgetKnVersionContext(networkId);
}

/** Copy a version into the draft, or (without `fromVersion`) discard the draft's changes. */
export async function resetKnDraft(
  networkId: string,
  input: KnResetDraftInput,
): Promise<KnVersioning> {
  assertBackend();
  const response = await http.post<KnVersioning>(
    `${base(networkId)}/draft/reset`,
    {
      expected_draft_revision: input.expectedDraftRevision,
      from_version: input.fromVersion,
      overwrite_changes: input.overwriteChanges || undefined,
    },
    { headers: idempotencyHeaders(), skipErrorToast: true },
  );
  forgetKnVersionContext(networkId);
  return response.data;
}

export async function diffKnVersions(
  networkId: string,
  from: KnVersionView,
  to: KnVersionView,
): Promise<KnDiffResult> {
  assertBackend();
  const response = await http.post<KnDiffResult>(
    "/bkn-backend/v1/bkns/diff",
    {
      base: { kn_id: networkId, kn_version: String(from) },
      target: { kn_id: networkId, kn_version: String(to) },
    },
    { skipErrorToast: true },
  );
  return response.data;
}
