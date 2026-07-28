/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

let monacoSetupPromise: Promise<void> | undefined;

export function ensureMonacoSetup() {
  monacoSetupPromise ??= import("@/framework/monaco/setup").then(() => undefined);

  return monacoSetupPromise;
}
