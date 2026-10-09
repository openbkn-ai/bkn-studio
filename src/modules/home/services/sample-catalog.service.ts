/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import axios from "axios";

import { http } from "@/framework/request/http";
import {
  parseSampleCatalog,
  parseSampleInstallation,
  type SampleCatalog,
  type SampleInstallation,
} from "@/modules/home/lib/sample-catalog";

const SAMPLE_API = "/studio/samples";
const INSTALL_TIMEOUT_MS = 30000;

export class SampleRequestError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "SampleRequestError";
    this.code = code;
  }
}

export async function listSamples(): Promise<SampleCatalog> {
  const response = await http.get<unknown>(SAMPLE_API, { skipErrorToast: true });
  return parseSampleCatalog(response.data);
}

export async function refreshSamples(): Promise<SampleCatalog> {
  const response = await http.post<unknown>(
    `${SAMPLE_API}/refresh`,
    {},
    { skipErrorToast: true, timeout: 30000 },
  );
  return parseSampleCatalog(response.data);
}

export async function getSampleInstallation(
  sampleName: string,
  installationId: string,
): Promise<SampleInstallation> {
  const response = await http.get<unknown>(installationPath(sampleName, installationId), {
    skipErrorToast: true,
  });
  return parseSampleInstallation(response.data);
}

export async function createSampleInstallation(
  sampleName: string,
  release?: { version: string; manifestSha256: string },
): Promise<SampleInstallation> {
  try {
    const response = await http.post<unknown>(
      `${samplePath(sampleName)}/installations`,
      release ?? {},
      { skipErrorToast: true, timeout: INSTALL_TIMEOUT_MS },
    );
    return parseSampleInstallation(response.data);
  } catch (error) {
    throw toSampleRequestError(error);
  }
}

export async function retrySampleInstallation(
  sampleName: string,
  installationId: string,
): Promise<SampleInstallation> {
  try {
    const response = await http.post<unknown>(
      `${installationPath(sampleName, installationId)}/retry`,
      {},
      { skipErrorToast: true, timeout: INSTALL_TIMEOUT_MS },
    );
    return parseSampleInstallation(response.data);
  } catch (error) {
    throw toSampleRequestError(error);
  }
}

export function readSampleRequestError(error: unknown) {
  return toSampleRequestError(error);
}

export type SampleReleaseNotes = {
  version: string;
  resolvedLocale: string;
  content: string;
  digest: string;
};

export async function getSampleReleaseNotes(
  sampleName: string,
  version: string,
  locale: string,
): Promise<SampleReleaseNotes> {
  const response = await http.get<unknown>(
    `${samplePath(sampleName)}/versions/${encodeURIComponent(version)}/release-notes`,
    { params: { locale }, skipErrorToast: true },
  );
  const data = response.data;
  if (
    !isRecord(data) ||
    data.sample !== sampleName ||
    data.version !== version ||
    typeof data.content !== "string" ||
    !data.content.trim() ||
    typeof data.resolvedLocale !== "string" ||
    typeof data.digest !== "string" ||
    !/^sha256:[a-f0-9]{64}$/.test(data.digest)
  )
    throw new Error("Invalid release notes response");
  return {
    version,
    content: data.content,
    resolvedLocale: data.resolvedLocale,
    digest: data.digest,
  };
}

export async function listSampleInstallations(sampleName: string) {
  const response = await http.get<unknown>(`${samplePath(sampleName)}/installations`, {
    skipErrorToast: true,
  });
  if (!isRecord(response.data) || !Array.isArray(response.data.items))
    throw new Error("Invalid installation history response");
  const items = response.data.items.map(parseSampleInstallation);
  if (items.some((item) => item.sample !== sampleName))
    throw new Error("Installation history sample mismatch");
  return { items, historyComplete: response.data.historyComplete === true };
}

function samplePath(sampleName: string) {
  return `${SAMPLE_API}/${encodeURIComponent(sampleName)}`;
}

function installationPath(sampleName: string, installationId: string) {
  return `${samplePath(sampleName)}/installations/${encodeURIComponent(installationId)}`;
}

function toSampleRequestError(error: unknown) {
  if (error instanceof SampleRequestError) {
    return error;
  }

  if (!axios.isAxiosError<unknown>(error)) {
    return new SampleRequestError("install_failed", "");
  }

  // A missing response does not establish whether the server accepted the task.
  if (!error.response) {
    return new SampleRequestError("status_unknown", "");
  }

  const data = isRecord(error.response?.data) ? error.response.data : {};
  const nested = isRecord(data.error) ? data.error : {};
  const code =
    optionalString(data.code) ??
    optionalString(nested.code) ??
    optionalString(data.error_code) ??
    "install_failed";
  const message = optionalString(data.message) ?? optionalString(nested.message) ?? "";

  return new SampleRequestError(code, message);
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
