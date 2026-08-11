/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useState } from "react";

import { listUsers } from "@/modules/system-admin/services/admin.service";
import { buildAuditUserDirectory } from "@/modules/execution-factory/utils/audit-user-display";

/**
 * This directory only renders user IDs in audit fields as names and does not change during a session.
 * Cache the promise rather than the result so simultaneous component mounts issue only one users?limit=500 request.
 */
let directoryPromise: Promise<Map<string, string>> | null = null;

function loadDirectory(): Promise<Map<string, string>> {
  directoryPromise ??= listUsers({ skipErrorToast: true })
    .then((users) => buildAuditUserDirectory(users))
    .catch(() => {
      // Do not cache failures so the next mounted component can retry.
      directoryPromise = null;
      return new Map<string, string>();
    });

  return directoryPromise;
}

/** Call after user creation, deletion, or update so the next read refetches. */
export function invalidateAuditUserDirectory() {
  directoryPromise = null;
}

export function useAuditUserDirectory() {
  const [directory, setDirectory] = useState<Map<string, string>>(() => new Map());

  useEffect(() => {
    let active = true;

    void loadDirectory().then((next) => {
      if (active) {
        setDirectory(next);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return directory;
}
