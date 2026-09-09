/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function sanitizeDownloadFilename(name: string, fallback: string) {
  const sanitized = name.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "");
  return sanitized || fallback;
}

/**
 * Reads the download name the backend chose. `filename*` is preferred over
 * `filename` because only the former declares an encoding, so a name outside
 * ASCII survives it; a header carrying neither leaves the caller to name the
 * file itself.
 */
export function parseContentDispositionFilename(
  contentDisposition?: string,
): string | undefined {
  if (!contentDisposition?.trim()) {
    return undefined;
  }

  const encoded = /filename\*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(contentDisposition)?.[1];

  if (encoded) {
    try {
      return decodeURIComponent(encoded.trim()) || undefined;
    } catch {
      return encoded.trim() || undefined;
    }
  }

  const filenameMatch = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i.exec(contentDisposition);

  if (!filenameMatch?.[1]) {
    return undefined;
  }

  const raw = filenameMatch[1].replace(/['"]/g, "").trim();
  if (!raw) {
    return undefined;
  }

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
