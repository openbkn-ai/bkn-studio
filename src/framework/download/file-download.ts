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

// Control characters, path separators and the characters Windows refuses in
// file names. Everything else (Chinese, emoji, spaces, parentheses, ...) is a
// legitimate part of a user-facing file name and must survive.
// eslint-disable-next-line no-control-regex
const ILLEGAL_FILENAME_CHARS = /[\u0000-\u001f\u007f/\\:*?"<>|]+/g;

/**
 * Make a display name safe to hand to `anchor.download`. Only path
 * separators, control characters and platform-illegal characters are
 * replaced; Unicode is kept. Returns `fallback` when nothing usable remains.
 */
export function sanitizeDownloadFilename(name: string, fallback: string) {
  const sanitized = name
    .replace(ILLEGAL_FILENAME_CHARS, "_")
    .trim()
    .replace(/^[._ ]+|[._ ]+$/g, "")
    .trim();
  return sanitized || fallback;
}

interface DispositionParam {
  key: string;
  value: string;
}

/**
 * Split a Content-Disposition value into its parameters. Quoted strings may
 * contain `;` and backslash-escaped quotes, so a plain `split(";")` or a
 * single regex is not enough.
 */
function parseDispositionParams(header: string): DispositionParam[] {
  const params: DispositionParam[] = [];
  let index = header.indexOf(";");
  if (index < 0) {
    return params;
  }
  index += 1;

  while (index < header.length) {
    while (index < header.length && /[\s;]/.test(header[index])) {
      index += 1;
    }
    if (index >= header.length) {
      break;
    }
    const equals = header.indexOf("=", index);
    if (equals < 0) {
      break;
    }
    const key = header.slice(index, equals).trim().toLowerCase();
    index = equals + 1;
    while (index < header.length && /\s/.test(header[index])) {
      index += 1;
    }

    let value = "";
    if (header[index] === '"') {
      index += 1;
      while (index < header.length && header[index] !== '"') {
        if (header[index] === "\\" && index + 1 < header.length) {
          index += 1;
        }
        value += header[index];
        index += 1;
      }
      index += 1;
    } else {
      const end = header.indexOf(";", index);
      value = header.slice(index, end < 0 ? header.length : end).trim();
      index = end < 0 ? header.length : end;
    }
    if (key) {
      params.push({ key, value });
    }
  }
  return params;
}

/**
 * Decode an RFC 5987 `charset'lang'percent-encoded` value. Only UTF-8 (and
 * its ASCII subset) is supported; anything else yields `undefined` so the
 * caller falls back to the plain `filename` parameter.
 */
function decodeRfc5987(value: string): string | undefined {
  const match = /^([^']*)'[^']*'(.*)$/.exec(value);
  if (!match) {
    return undefined;
  }
  const charset = match[1].toLowerCase();
  if (charset !== "utf-8" && charset !== "utf8" && charset !== "us-ascii") {
    return undefined;
  }
  try {
    return decodeURIComponent(match[2]);
  } catch {
    return undefined;
  }
}

/**
 * Reads the download name the backend chose.
 *
 * Priority follows RFC 6266: a decodable `filename*` (UTF-8) wins over the
 * plain `filename`, whatever their order in the header. The plain value is
 * taken literally, as browsers do, so a `%` in a name stays a `%`. The result
 * is sanitized so a server can never smuggle a path through the header.
 * Returns `undefined` when the header is missing or carries no usable name,
 * leaving the caller to name the file itself.
 */
export function parseContentDispositionFilename(
  contentDisposition?: string,
): string | undefined {
  if (!contentDisposition?.trim()) {
    return undefined;
  }

  const params = parseDispositionParams(contentDisposition);
  const extended = params.find((param) => param.key === "filename*");
  const plain = params.find((param) => param.key === "filename");

  const candidates: string[] = [];
  if (extended) {
    const decoded = decodeRfc5987(extended.value);
    if (decoded) {
      candidates.push(decoded);
    }
  }
  if (plain?.value) {
    candidates.push(plain.value);
  }

  for (const candidate of candidates) {
    const sanitized = sanitizeDownloadFilename(candidate, "");
    if (sanitized) {
      return sanitized;
    }
  }
  return undefined;
}
