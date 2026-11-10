/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";

import i18n from "@/app/locales/i18n";
import { registerErrorCodeMessage } from "@/framework/request/error-message";
import { http } from "@/framework/request/http";
import type { KnVersioning, KnVersionView } from "@/modules/knowledge-network/types/kn-version";

/**
 * Per-network version context for requests against bkn-backend.
 *
 * A network with versioning keeps its definitions in a draft and publishes numbered versions
 * from it. Every definition service in this module was written against one branch, so the
 * version handling lives here, at the request layer, and the services stay as they are:
 *
 * - a read of a versioned network asks for the version being viewed (`kn_version`), the draft
 *   by default;
 * - a write goes to the draft and carries the precondition its operation needs: `If-Match`
 *   with the ETag of the definition that was read, or `expected_draft_revision`;
 * - a write while an older version or the running version is on screen is refused locally.
 *
 * Networks without versioning pass through unchanged.
 */

const NETWORK_PATH = /^\/bkn-backend\/v1\/knowledge-networks\/([^/?#]+)(\/[^?#]*)?(?:[?#].*)?$/;

/** Sub-resources that are not definitions, or that take version arguments of their own. */
const UNSCOPED_PREFIXES = ["/versions", "/versioning", "/draft", "/evals"];

/** How long a failed probe is trusted before the next request tries again. */
const PROBE_FAILURE_TTL_MS = 30_000;

type KnVersionContext = {
  versioned: boolean;
  /** The user may read and edit the draft (network `modify`). */
  canDraft: boolean;
  view: KnVersionView;
  draftRevision?: number;
  runningVersion: number;
  versioning?: KnVersioning;
  /** A failed probe is remembered only until this time. */
  expiresAt?: number;
};

type KnRequestConfig = InternalAxiosRequestConfig & {
  _knProbe?: boolean;
  _knSkip?: boolean;
};

declare module "axios" {
  interface AxiosRequestConfig {
    /** Do not apply the version context to this request. */
    _knSkip?: boolean;
    /** Marks the request that discovers the version state of a network. */
    _knProbe?: boolean;
  }
}

// "Somebody else changed this" reads the same wherever it surfaces: a save, a delete, a publish.
["DefinitionModified", "DraftRevisionMismatch"].forEach((code) => {
  registerErrorCodeMessage(`BknBackend.KNVersion.${code}`, () =>
    i18n.t("knowledgeNetwork.versions.conflict"),
  );
});

export class KnVersionReadOnlyError extends Error {
  constructor() {
    super(i18n.t("knowledgeNetwork.versions.writeBlocked"));
    this.name = "KnVersionReadOnlyError";
  }
}

const contexts = new Map<string, KnVersionContext>();
const probes = new Map<string, Promise<KnVersionContext>>();
const etags = new Map<string, string>();
const listeners = new Set<() => void>();
let installed = false;

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeKnVersionContext(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function decode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseNetworkPath(url: string | undefined) {
  const match = url ? NETWORK_PATH.exec(url) : null;
  if (!match) {
    return null;
  }
  return { knId: decode(match[1]), rest: match[2] ?? "" };
}

function isUnscoped(rest: string) {
  return UNSCOPED_PREFIXES.some((prefix) => rest === prefix || rest.startsWith(`${prefix}/`));
}

function defaultView(canDraft: boolean): KnVersionView {
  return canDraft ? "draft" : "running";
}

function viewStorageKey(knId: string) {
  return `bkn-studio.kn-version-view.${knId}`;
}

function readStoredView(knId: string): KnVersionView | null {
  try {
    const raw = window.sessionStorage.getItem(viewStorageKey(knId));
    if (raw === "draft" || raw === "running") {
      return raw;
    }
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function storeView(knId: string, view: KnVersionView) {
  try {
    window.sessionStorage.setItem(viewStorageKey(knId), String(view));
  } catch {
    // The view is a convenience; a blocked storage only forgets it on reload.
  }
}

/** Remember what the backend says about a network, from its `versioning` view. */
export function recordKnVersioning(
  knId: string,
  versioning: KnVersioning | null | undefined,
  operations?: readonly string[],
) {
  const previous = contexts.get(knId);
  const enabled = Boolean(versioning?.enabled);
  const canDraft = operations ? operations.includes("modify") : (previous?.canDraft ?? false);
  let view = previous?.view ?? readStoredView(knId) ?? defaultView(canDraft);

  if (!enabled) {
    view = "running";
  } else if (view === "draft" && !canDraft) {
    // Reading the draft needs modify; fall back to what everyone else sees.
    view = "running";
  }

  contexts.set(knId, {
    versioned: enabled,
    canDraft,
    view,
    draftRevision: versioning?.draft?.revision ?? previous?.draftRevision,
    runningVersion: versioning?.running_version ?? 0,
    versioning: versioning ?? undefined,
  });
  emit();
}

export function getKnVersionContext(knId: string): KnVersionContext | undefined {
  return contexts.get(knId);
}

export function isKnVersioned(knId: string) {
  return contexts.get(knId)?.versioned ?? false;
}

export function getKnVersionView(knId: string): KnVersionView {
  return contexts.get(knId)?.view ?? "running";
}

export function setKnVersionView(knId: string, view: KnVersionView) {
  const current = contexts.get(knId);
  if (!current || current.view === view) {
    return;
  }
  contexts.set(knId, { ...current, view });
  storeView(knId, view);
  emit();
}

/** The draft revision last seen for a network, from a response header or the version state. */
export function getKnDraftRevision(knId: string) {
  return contexts.get(knId)?.draftRevision;
}

export function noteKnDraftRevision(knId: string, revision: number | undefined) {
  const current = contexts.get(knId);
  if (!current || revision === undefined || current.draftRevision === revision) {
    return;
  }
  contexts.set(knId, { ...current, draftRevision: revision });
}

/** Forget what is known, so the next request asks the backend again. */
export function forgetKnVersionContext(knId: string) {
  contexts.delete(knId);
  probes.delete(knId);
  for (const key of [...etags.keys()]) {
    if (key.startsWith(`${knId}\u0000`)) {
      etags.delete(key);
    }
  }
  emit();
}

function toVersioning(value: unknown): KnVersioning | null {
  return value && typeof value === "object" ? (value as KnVersioning) : null;
}

function networkRecord(data: unknown): { versioning?: unknown; operations?: string[] } | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const record = data as { entries?: unknown };
  const first: unknown = Array.isArray(record.entries) ? record.entries[0] : data;
  return first && typeof first === "object" ? first : null;
}

async function probe(knId: string): Promise<KnVersionContext> {
  try {
    const response = await http.get<unknown>(
      `/bkn-backend/v1/knowledge-networks/${encodeURIComponent(knId)}`,
      { _knProbe: true, skipErrorToast: true },
    );
    // The response interceptor records the state; this reads it back.
    const known = contexts.get(knId);
    if (known) {
      return known;
    }
    const record = networkRecord(response.data);
    recordKnVersioning(knId, toVersioning(record?.versioning), record?.operations);
  } catch {
    contexts.set(knId, {
      versioned: false,
      canDraft: false,
      view: "running",
      runningVersion: 0,
      expiresAt: Date.now() + PROBE_FAILURE_TTL_MS,
    });
  }
  return contexts.get(knId) as KnVersionContext;
}

/** The version context of a network, asking the backend once when it is not known yet. */
export async function ensureKnVersionContext(knId: string): Promise<KnVersionContext> {
  const known = contexts.get(knId);
  if (known && (known.expiresAt === undefined || known.expiresAt > Date.now())) {
    return known;
  }
  const pending = probes.get(knId);
  if (pending) {
    return pending;
  }
  const next = probe(knId).finally(() => {
    probes.delete(knId);
  });
  probes.set(knId, next);
  return next;
}

/** `kn_version` of the version on screen, or none when the network has no versioning. */
export function knVersionParam(context: KnVersionContext): string | undefined {
  return context.versioned ? String(context.view) : undefined;
}

/**
 * Query parameters that select the version being viewed, for requests the interceptor does not
 * see (ontology-query). A network without versioning keeps the main branch.
 */
export async function resolveKnReadParams(knId: string): Promise<Record<string, string>> {
  const context = await ensureKnVersionContext(knId);
  const kn_version = knVersionParam(context);
  return kn_version === undefined ? { branch: "main" } : { kn_version };
}

/**
 * `kn_version` of the version on screen, for requests the interceptor does not see. Empty when
 * the network has no versioning or its state is not known yet (nothing is on screen then).
 */
export function knVersionQuery(knId: string): Record<string, string> {
  const context = contexts.get(knId);
  const kn_version = context ? knVersionParam(context) : undefined;
  return kn_version === undefined ? {} : { kn_version };
}

function etagKey(knId: string, rest: string) {
  return `${knId}\u0000${rest}`;
}

function withoutQuoteWrap(value: string) {
  return value.replace(/^W\//, "");
}

function singleDefinition(rest: string) {
  const segments = rest.split("/").filter(Boolean);
  return segments.length === 2 && !segments[1].includes(",");
}

function withoutBranch(params: Record<string, unknown>) {
  const rest = { ...params };
  delete rest.branch;
  return rest;
}

function withParams(config: KnRequestConfig, extra: Record<string, unknown>) {
  const current =
    config.params &&
    typeof config.params === "object" &&
    !(config.params instanceof URLSearchParams)
      ? (config.params as Record<string, unknown>)
      : {};
  config.params = { ...current, ...extra };
}

async function fetchEtag(knId: string, rest: string, url: string) {
  try {
    await http.get(url.replace(/\?.*$/, ""), {
      _knProbe: true,
      params: { kn_version: "draft" },
      skipErrorToast: true,
    });
  } catch {
    // The write that follows reports the real problem.
  }
  return etags.get(etagKey(knId, rest));
}

async function applyKnVersion(config: KnRequestConfig): Promise<KnRequestConfig> {
  const target = parseNetworkPath(config.url);
  if (!target || config._knSkip || config._knProbe || isUnscoped(target.rest)) {
    return config;
  }

  const method = (config.method ?? "get").toLowerCase();
  const context = await ensureKnVersionContext(target.knId);
  if (!context.versioned) {
    return config;
  }

  const existingParams = (config.params ?? {}) as Record<string, unknown>;
  if (method === "get" || method === "head") {
    if (existingParams.kn_version === undefined && context.view !== "running") {
      config.params = { ...withoutBranch(existingParams), kn_version: String(context.view) };
    }
    return config;
  }

  if (method === "post") {
    // Creates and validations go to the draft on their own; only the branch they name is dropped.
    if (context.view === "draft" && existingParams.branch !== undefined) {
      config.params = withoutBranch(existingParams);
    }
    return config;
  }

  if (method !== "put" && method !== "patch" && method !== "delete") {
    return config;
  }

  if (context.view !== "draft") {
    throw new KnVersionReadOnlyError();
  }
  if (existingParams.branch !== undefined) {
    config.params = withoutBranch(existingParams);
  }

  const currentParams = (config.params ?? {}) as Record<string, unknown>;
  const key = etagKey(target.knId, target.rest);
  const url = config.url ?? "";
  if (target.rest === "") {
    // The network itself: `skill_content` changes need the draft revision.
    const revision = context.draftRevision;
    if (revision !== undefined && currentParams.expected_draft_revision === undefined) {
      withParams(config, { expected_draft_revision: revision });
    }
    return config;
  }

  if (method === "delete" && !singleDefinition(target.rest)) {
    if (
      context.draftRevision !== undefined &&
      currentParams.expected_draft_revision === undefined
    ) {
      withParams(config, { expected_draft_revision: context.draftRevision });
    }
    return config;
  }

  if (!config.headers.has("If-Match")) {
    const etag = etags.get(key) ?? (await fetchEtag(target.knId, target.rest, url));
    if (etag) {
      config.headers.set("If-Match", etag);
    } else if (
      method === "delete" &&
      context.draftRevision !== undefined &&
      currentParams.expected_draft_revision === undefined
    ) {
      withParams(config, { expected_draft_revision: context.draftRevision });
    }
  }
  return config;
}

function headerValue(response: AxiosResponse, name: string): string | undefined {
  const value: unknown = response.headers?.[name];
  return typeof value === "string" && value ? value : undefined;
}

/**
 * Only a plain read of the network says whether it has versioning. A summary read (statistics)
 * or an export leaves the field out, and that must not read as "no versioning".
 */
function isFullNetworkRead(config: KnRequestConfig) {
  const params = (config.params ?? {}) as Record<string, unknown>;
  return params.detail_level === undefined && params.mode === undefined;
}

function observeResponse(response: AxiosResponse): AxiosResponse {
  const config = response.config as KnRequestConfig;
  const target = parseNetworkPath(config.url);
  if (!target) {
    return response;
  }

  const method = (config.method ?? "get").toLowerCase();
  const revisionHeader = headerValue(response, "x-kn-draft-revision");
  if (revisionHeader !== undefined && Number.isFinite(Number(revisionHeader))) {
    noteKnDraftRevision(target.knId, Number(revisionHeader));
  }

  if (method === "get" && target.rest === "" && isFullNetworkRead(config)) {
    const record = networkRecord(response.data);
    if (record && "id" in record) {
      recordKnVersioning(target.knId, toVersioning(record.versioning), record.operations);
    }
  }

  const key = etagKey(target.knId, target.rest);
  const etag = headerValue(response, "etag");
  if (method === "get" && etag && !isUnscoped(target.rest)) {
    etags.set(key, withoutQuoteWrap(etag));
  } else if (method === "put" || method === "patch") {
    // The definition moved on; a response without a new ETag means the next save reads it again.
    if (etag) {
      etags.set(key, withoutQuoteWrap(etag));
    } else {
      etags.delete(key);
    }
  } else if (method === "delete") {
    etags.delete(key);
  }
  return response;
}

export function installKnVersionInterceptors() {
  // A test that replaces the shared client with a stub has no interceptors to hook into.
  const interceptors = (http as { interceptors?: typeof http.interceptors }).interceptors;
  if (installed || !interceptors) {
    return;
  }
  installed = true;
  interceptors.request.use(applyKnVersion);
  interceptors.response.use(observeResponse);
}

installKnVersionInterceptors();

export function isKnVersionReadOnlyError(error: unknown) {
  return error instanceof KnVersionReadOnlyError;
}

/** Test helper: drop everything remembered. */
export function resetKnVersionContextForTests() {
  contexts.clear();
  probes.clear();
  etags.clear();
}
