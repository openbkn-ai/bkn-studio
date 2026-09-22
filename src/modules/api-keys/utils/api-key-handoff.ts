/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

const HANDOFF_TTL_MS = 60_000;

type ApiKeyHandoff = {
  expiresAt: number;
  key: string;
  returnTo: string;
};

const pendingHandoffs = new Map<string, ApiKeyHandoff>();

// 清理旧版遗留在 Web Storage 中的明文交接项。
if (typeof window !== "undefined") {
  try {
    window.sessionStorage.removeItem("openbkn.pending-api-key-handoff");
  } catch {
    // Ignore unavailable sessionStorage.
  }
}

function isSafeReturnTo(value: string | null | undefined): value is string {
  if (!value?.startsWith("/")) return false;
  try {
    return new URL(value, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
}

function createHandoffId(): string | null {
  const webCrypto = globalThis.crypto;
  if (!webCrypto) return null;
  if (typeof webCrypto.randomUUID === "function") return webCrypto.randomUUID();
  if (typeof webCrypto.getRandomValues !== "function") return null;

  const bytes = new Uint8Array(16);
  webCrypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function buildApiKeyPagePath(returnTo: string): string {
  return `/account/api-keys?${new URLSearchParams({ return_to: returnTo }).toString()}`;
}

export function readApiKeyReturnTo(search: string): string | null {
  const returnTo = new URLSearchParams(search).get("return_to");
  return isSafeReturnTo(returnTo) ? returnTo : null;
}

export function saveApiKeyHandoff(returnTo: string, key: string): string | null {
  if (typeof window === "undefined" || !isSafeReturnTo(returnTo) || !key) return null;
  const handoffId = createHandoffId();
  if (!handoffId) return null;
  pendingHandoffs.set(handoffId, { expiresAt: Date.now() + HANDOFF_TTL_MS, key, returnTo });
  return handoffId;
}

export function consumeApiKeyHandoff(currentPath: string, handoffId: unknown): string | null {
  if (typeof handoffId !== "string") return null;
  const handoff = pendingHandoffs.get(handoffId);
  pendingHandoffs.delete(handoffId);
  return handoff &&
    handoff.expiresAt >= Date.now() &&
    handoff.returnTo === currentPath &&
    handoff.key.startsWith("bak_")
    ? handoff.key
    : null;
}
