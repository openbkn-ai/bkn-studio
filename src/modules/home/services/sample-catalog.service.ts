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

const SAMPLE_API = "/api/studio/samples";

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

export async function getSampleInstallation(
  sampleName: string,
  installationId: string,
): Promise<SampleInstallation> {
  const response = await http.get<unknown>(installationPath(sampleName, installationId), {
    skipErrorToast: true,
  });
  return parseSampleInstallation(response.data);
}

export async function createSampleInstallation(sampleName: string): Promise<SampleInstallation> {
  try {
    const response = await http.post<unknown>(
      `${samplePath(sampleName)}/installations`,
      {},
      { skipErrorToast: true },
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
      { skipErrorToast: true },
    );
    return parseSampleInstallation(response.data);
  } catch (error) {
    throw toSampleRequestError(error);
  }
}

export function readSampleRequestError(error: unknown) {
  return toSampleRequestError(error);
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
