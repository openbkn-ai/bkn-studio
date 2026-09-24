/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const OFFICIAL_SAMPLE_SOURCE = "https://github.com/openbkn-ai/bkn-samples";
export const SAMPLE_NAMESPACE = "openbkn-samples";

const SAMPLE_NAME = /^[a-z0-9-]{1,32}$/;

export const SAMPLE_STATUSES = [
  "not_installed",
  "installing",
  "installed",
  "failed",
  "conflict",
  "unavailable",
] as const;

export type SampleStatus = (typeof SAMPLE_STATUSES)[number];

export const SAMPLE_STAGE_STATES = ["pending", "running", "succeeded", "failed"] as const;

export type SampleStageState = (typeof SAMPLE_STAGE_STATES)[number];

export type SampleKnowledgeNetwork = {
  displayName: string;
  id: string;
};

export type SampleCatalogItem = {
  catalogId?: string;
  displayName: string;
  expectedTables: number;
  installationId: string | null;
  installable: boolean;
  installedAt?: string;
  knowledgeNetwork: SampleKnowledgeNetwork;
  licenseNote: string;
  message: string;
  name: string;
  questions: string[];
  status: SampleStatus;
  summary: string;
  version: string;
};

export type SampleInstallationStage = {
  id: string;
  name: string;
  state: SampleStageState;
};

export type SampleInstallationError = {
  code: string;
  message: string;
  stage: string;
};

export type SampleInstallation = {
  error: SampleInstallationError | null;
  id: string;
  requestedBy: string;
  sample: string;
  stages: SampleInstallationStage[];
  status: SampleStatus;
  version: string;
};

export type SampleCatalog = {
  samples: SampleCatalogItem[];
  sourceRejected: boolean;
};

export type SampleCardAction = "install" | "none" | "open" | "retry";

export function sampleCatalogName(sampleName: string) {
  return `bkn-sample-${sampleName}`;
}

export function sampleCardAction(item: SampleCatalogItem): SampleCardAction {
  if (item.status === "installed") {
    return "open";
  }

  if (item.status === "failed") {
    return "retry";
  }

  if (item.status === "not_installed") {
    return "install";
  }

  return "none";
}

export function parseSampleCatalog(payload: unknown): SampleCatalog {
  if (Array.isArray(payload)) {
    return { samples: parseSamples(payload), sourceRejected: false };
  }

  if (!isRecord(payload)) {
    throw new Error("sample catalog payload is not an object");
  }

  const sourceRepo = optionalString(payload.sourceRepo);
  const sourceRejected =
    sourceRepo !== undefined && normalizeSource(sourceRepo) !== OFFICIAL_SAMPLE_SOURCE;
  const records = payload.samples ?? payload.items;

  if (!Array.isArray(records)) {
    throw new Error("sample catalog payload has no samples");
  }

  const samples = parseSamples(records).map((item) =>
    sourceRejected ? { ...item, installable: false, status: "unavailable" as const } : item,
  );

  return { samples, sourceRejected };
}

export function parseSampleInstallation(payload: unknown): SampleInstallation {
  if (!isRecord(payload)) {
    throw new Error("sample installation payload is not an object");
  }

  const id = requiredString(payload.id, "installation id");
  const sample = requiredName(payload.sample);
  const status = requiredStatus(payload.status);
  const stages = Array.isArray(payload.stages) ? payload.stages.flatMap(parseStage) : [];

  return {
    error: parseInstallationError(payload.error),
    id,
    requestedBy: optionalString(payload.requestedBy) ?? "",
    sample,
    stages,
    status,
    version: optionalString(payload.version) ?? "",
  };
}

function parseSamples(records: unknown[]): SampleCatalogItem[] {
  return records.flatMap((record) => {
    const item = parseSample(record);
    return item ? [item] : [];
  });
}

function parseSample(payload: unknown): SampleCatalogItem | null {
  const name = isRecord(payload) ? optionalString(payload.name) : undefined;

  if (!isRecord(payload) || !name || !SAMPLE_NAME.test(name)) {
    return null;
  }

  const status = SAMPLE_STATUSES.find((item) => item === payload.status);
  const network = isRecord(payload.knowledgeNetwork) ? payload.knowledgeNetwork : null;
  const networkId = optionalString(network?.id);

  if (!status || !networkId) {
    return null;
  }

  const installed = status === "installed";

  return {
    catalogId: optionalString(payload.catalogId),
    displayName: optionalString(payload.displayName) ?? payload.name,
    expectedTables: finiteCount(payload.expectedTables),
    installationId: optionalString(payload.installationId) ?? null,
    installable: payload.installable === true,
    installedAt: installed ? optionalString(payload.installedAt) : undefined,
    knowledgeNetwork: {
      displayName: optionalString(network?.displayName) ?? networkId,
      id: networkId,
    },
    licenseNote: optionalString(payload.licenseNote) ?? "",
    message: optionalString(payload.message) ?? "",
    name,
    questions: installed ? stringList(payload.questions) : [],
    status,
    summary: optionalString(payload.summary) ?? "",
    version: optionalString(payload.version) ?? "",
  };
}

function parseStage(payload: unknown): SampleInstallationStage[] {
  if (!isRecord(payload)) {
    return [];
  }

  const id = optionalString(payload.id);
  const name = optionalString(payload.name);

  if (!id || !name) {
    return [];
  }

  const state = SAMPLE_STAGE_STATES.find((item) => item === payload.state) ?? "pending";

  return [{ id, name, state }];
}

function parseInstallationError(payload: unknown): SampleInstallationError | null {
  if (!isRecord(payload)) {
    return null;
  }

  const code = optionalString(payload.code);
  const message = optionalString(payload.message) ?? "";

  if (!code && !message) {
    return null;
  }

  return {
    code: code ?? "install_failed",
    message,
    stage: optionalString(payload.stage) ?? "",
  };
}

function requiredStatus(value: unknown): SampleStatus {
  const status = SAMPLE_STATUSES.find((item) => item === value);

  if (!status) {
    throw new Error("sample installation status is missing");
  }

  return status;
}

function requiredName(value: unknown) {
  const name = optionalString(value);

  if (!name || !SAMPLE_NAME.test(name)) {
    throw new Error("sample installation name is missing");
  }

  return name;
}

function requiredString(value: unknown, label: string) {
  const text = optionalString(value);

  if (!text) {
    throw new Error(`${label} is missing`);
  }

  return text;
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const text = optionalString(item);
    return text ? [text] : [];
  });
}

function finiteCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeSource(value: string) {
  return value.trim().replace(/\/+$/, "").replace(/\.git$/i, "");
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
