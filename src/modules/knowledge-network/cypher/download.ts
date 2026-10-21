/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** Saves text as a file. `bom` marks UTF-8 for spreadsheet apps that would guess otherwise. */
export function downloadText(fileName: string, text: string, type: string, bom = false): void {
  const parts = bom ? [String.fromCharCode(0xfeff), text] : [text];
  const url = URL.createObjectURL(new Blob(parts, { type: `${type};charset=utf-8` }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
