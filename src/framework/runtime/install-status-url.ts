/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

const INSTALL_STATUS_PATH = "/install-status";

function resolveConfiguredInstallStatusUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("/")) {
    if (typeof window !== "undefined") {
      return `${window.location.origin}${trimmed}`;
    }
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Install-status page URL for the user menu.
 *
 * Default: same gateway host as the studio SPA (`<origin>/install-status`), so
 * deployed builds follow whatever host the operator opened without rebaking env.
 * Override with VITE_INSTALL_STATUS_URL for local dev or split-host setups.
 */
export function getInstallStatusUrl(): string | null {
  const raw: unknown = import.meta.env.VITE_INSTALL_STATUS_URL;
  if (typeof raw === "string") {
    const configured = resolveConfiguredInstallStatusUrl(raw);
    if (configured) {
      return configured;
    }
  }

  if (typeof window !== "undefined") {
    return `${window.location.origin}${INSTALL_STATUS_PATH}`;
  }

  return null;
}
