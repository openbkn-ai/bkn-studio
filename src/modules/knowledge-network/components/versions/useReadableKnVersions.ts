/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useState } from "react";

import { knVersionName } from "@/modules/knowledge-network/lib/kn-version-format";
import { listKnVersions } from "@/modules/knowledge-network/services/kn-version.service";
import type { KnVersion } from "@/modules/knowledge-network/types/kn-version";

/**
 * The versions a viewer can read: not purged, and in the Community edition only the running and
 * the previous one. Reloads when the running version changes.
 */
export function useReadableKnVersions(
  networkId: string,
  runningVersion: number,
  reloadKey: number | string = 0,
) {
  const [versions, setVersions] = useState<KnVersion[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listKnVersions(networkId, { status: ["running", "history", "deprecated"] })
      .then((page) => {
        if (!cancelled) {
          setVersions(page.items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVersions([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [networkId, runningVersion, reloadKey]);

  return versions;
}

export function versionOptionLabel(version: KnVersion) {
  return version.label
    ? `${knVersionName(version.version)} · ${version.label}`
    : knVersionName(version.version);
}
