/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import axios from "axios";

import { http } from "@/framework/request/http";
import type {
  LicenseActivationCode,
  LicenseDetail,
  LicenseState,
} from "@/modules/system-admin/types/license";

const useMock = import.meta.env.VITE_USE_MOCK !== "false";

const ADMIN_LICENSE = "/safe/v1/admin/license";

type BackendLicenseDetail = {
  activated?: boolean;
  contract_expires_at?: number;
  customer?: {
    email?: string;
    name?: string;
    project?: string;
  };
  edition?: string;
  error?: string;
  expires_at?: number;
  features?: string[];
  grace_remaining_days?: number;
  instance_fp?: string;
  issued_at?: number;
  lic_id?: string;
  limits?: Record<string, number>;
  renew_error?: string;
  state?: LicenseState;
};

type BackendActivationCode = {
  activation_code?: string;
  instance_fp?: string;
  lic_id?: string;
};

type LicenseErrorBody = {
  error?: string;
  message?: string;
  stored?: boolean;
};

export type LicenseRequestErrorCode =
  | "activationUnavailable"
  | "activationConflict"
  | "boundToOtherCluster"
  | "invalidLicense"
  | "serverUnavailable"
  | "unknown";

const wait = async <T,>(value: T) =>
  new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(value), 160);
  });

let mockLicense: LicenseDetail = {
  activated: true,
  contractExpiresAt: Math.floor(Date.now() / 1000) + 180 * 86_400,
  customer: {
    email: "ops@example.com",
    name: "OpenBKN Demo Customer",
    project: "BKN Studio",
  },
  edition: "enterprise",
  features: ["rbac_basic", "source_sync", "execution_factory"],
  instanceFp: "fp_35dc9c8c95a091cc",
  issuedAt: Math.floor(Date.now() / 1000) - 30 * 86_400,
  licId: "demo-license-2026",
  limits: {
    max_users: 100,
    max_networks: -1,
  },
  state: "valid",
};

const mockActivationCode: LicenseActivationCode = {
  activationCode:
    "eyJsaWNfaWQiOiJkZW1vLWxpY2Vuc2UtMjAyNiIsImluc3RhbmNlX2ZwIjoiZnBfMzVkYzljOGM5NWEwOTFjYyJ9",
  instanceFp: "fp_35dc9c8c95a091cc",
  licId: "demo-license-2026",
};

export function mapLicenseDetail(item: BackendLicenseDetail): LicenseDetail {
  return {
    activated: item.activated ?? false,
    contractExpiresAt: item.contract_expires_at,
    customer: item.customer,
    edition: item.edition ?? "community",
    error: item.error,
    expiresAt: item.expires_at,
    features: item.features ?? [],
    graceRemainingDays: item.grace_remaining_days,
    instanceFp: item.instance_fp,
    issuedAt: item.issued_at,
    licId: item.lic_id,
    limits: item.limits ?? {},
    renewError: item.renew_error,
    state: item.state ?? "invalid",
  };
}

export function mapActivationCode(item: BackendActivationCode): LicenseActivationCode {
  return {
    activationCode: item.activation_code ?? "",
    instanceFp: item.instance_fp ?? "",
    licId: item.lic_id,
  };
}

export function resolveLicenseRequestErrorCode(error: unknown): LicenseRequestErrorCode {
  if (!axios.isAxiosError<LicenseErrorBody>(error)) {
    return "unknown";
  }

  const status = error.response?.status;
  const body = error.response?.data;
  const text = [body?.error, body?.message].filter(Boolean).join(" ").toLowerCase();

  if (status === 400 && text.includes("activation")) {
    return "activationUnavailable";
  }
  if (status === 400) {
    return "invalidLicense";
  }
  if (status === 409 && body?.stored) {
    return "activationConflict";
  }
  if (status === 409) {
    return "boundToOtherCluster";
  }
  if (status === 502) {
    return "serverUnavailable";
  }
  return "unknown";
}

export async function getLicenseDetail(): Promise<LicenseDetail> {
  if (useMock) {
    return wait({ ...mockLicense, customer: { ...mockLicense.customer }, limits: { ...mockLicense.limits } });
  }

  const response = await http.get<BackendLicenseDetail>(ADMIN_LICENSE, {
    skipErrorToast: true,
  });
  return mapLicenseDetail(response.data);
}

export async function getLicenseFingerprint(): Promise<string> {
  if (useMock) {
    return wait(mockLicense.instanceFp ?? mockActivationCode.instanceFp);
  }

  const response = await http.get<{ instance_fp?: string }>(
    `${ADMIN_LICENSE}/fingerprint`,
    { skipErrorToast: true },
  );
  return response.data.instance_fp ?? "";
}

export async function getLicenseActivationCode(): Promise<LicenseActivationCode> {
  if (useMock) {
    return wait({ ...mockActivationCode, instanceFp: mockLicense.instanceFp ?? mockActivationCode.instanceFp });
  }

  const response = await http.get<BackendActivationCode>(
    `${ADMIN_LICENSE}/activation-code`,
    { skipErrorToast: true },
  );
  return mapActivationCode(response.data);
}

export async function importLicense(license: string): Promise<LicenseDetail> {
  if (useMock) {
    mockLicense = {
      ...mockLicense,
      activated: false,
      error: undefined,
      features: ["rbac_basic", "source_sync"],
      licId: "imported-license",
      renewError: undefined,
      state: "valid",
    };
    return wait({ ...mockLicense });
  }

  const response = await http.post<BackendLicenseDetail>(
    `${ADMIN_LICENSE}/import`,
    { license },
    { skipErrorToast: true },
  );
  return mapLicenseDetail(response.data);
}

export async function importLicenseReceipt(license: string): Promise<LicenseDetail> {
  if (useMock) {
    mockLicense = {
      ...mockLicense,
      activated: true,
      error: undefined,
      renewError: undefined,
      state: "valid",
    };
    return wait({ ...mockLicense });
  }

  const response = await http.post<BackendLicenseDetail>(
    `${ADMIN_LICENSE}/receipt`,
    { license },
    { skipErrorToast: true },
  );
  return mapLicenseDetail(response.data);
}

export async function activateLicense(): Promise<LicenseDetail> {
  if (useMock) {
    mockLicense = {
      ...mockLicense,
      activated: true,
      error: undefined,
      renewError: undefined,
      state: "valid",
    };
    return wait({ ...mockLicense });
  }

  const response = await http.post<BackendLicenseDetail>(
    `${ADMIN_LICENSE}/activate`,
    undefined,
    { skipErrorToast: true },
  );
  return mapLicenseDetail(response.data);
}

export async function deleteLicense() {
  if (useMock) {
    mockLicense = {
      activated: false,
      edition: "community",
      error: "No license has been imported.",
      features: [],
      instanceFp: mockActivationCode.instanceFp,
      limits: {},
      state: "invalid",
    };
    return wait(undefined);
  }

  await http.delete(ADMIN_LICENSE, { skipErrorToast: true });
}
