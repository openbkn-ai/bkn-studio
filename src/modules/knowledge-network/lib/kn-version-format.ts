/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { KnAccountInfo, KnVersionView } from "@/modules/knowledge-network/types/kn-version";

/** `v3`, the short name of a version number. */
export function knVersionName(version: number) {
  return `v${version}`;
}

export function knAccountName(account: KnAccountInfo | undefined) {
  return account?.name || account?.id || "-";
}

export function parseKnVersionView(value: string): KnVersionView {
  if (value === "draft" || value === "running") {
    return value;
  }
  return Number(value);
}

/** Whether two views read the same content: the running version is also its own number. */
export function sameKnView(left: KnVersionView, right: KnVersionView, runningVersion: number) {
  const resolve = (view: KnVersionView) => (view === "running" ? runningVersion : view);
  return resolve(left) === resolve(right);
}
