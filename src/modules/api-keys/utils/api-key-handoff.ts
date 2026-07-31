/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

const HANDOFF_STORAGE_KEY = "openbkn.pending-api-key-handoff";

type ApiKeyHandoff = {
  key: string;
  returnTo: string;
};

function isSafeReturnTo(value: string | null | undefined): value is string {
  return Boolean(value && value.startsWith("/") && !value.startsWith("//"));
}

export function buildApiKeyPagePath(returnTo: string): string {
  return `/account/api-keys?${new URLSearchParams({ return_to: returnTo }).toString()}`;
}

export function readApiKeyReturnTo(search: string): string | null {
  const returnTo = new URLSearchParams(search).get("return_to");
  return isSafeReturnTo(returnTo) ? returnTo : null;
}

export function saveApiKeyHandoff(returnTo: string, key: string): void {
  if (typeof window === "undefined" || !isSafeReturnTo(returnTo) || !key) return;
  window.sessionStorage.setItem(HANDOFF_STORAGE_KEY, JSON.stringify({ returnTo, key } satisfies ApiKeyHandoff));
}

export function consumeApiKeyHandoff(currentPath: string): string | null {
  if (typeof window === "undefined") return null;
  const serialized = window.sessionStorage.getItem(HANDOFF_STORAGE_KEY);
  window.sessionStorage.removeItem(HANDOFF_STORAGE_KEY);
  if (!serialized) return null;

  try {
    const handoff = JSON.parse(serialized) as Partial<ApiKeyHandoff>;
    return handoff.returnTo === currentPath && typeof handoff.key === "string" && handoff.key.startsWith("bak_")
      ? handoff.key
      : null;
  } catch {
    return null;
  }
}
