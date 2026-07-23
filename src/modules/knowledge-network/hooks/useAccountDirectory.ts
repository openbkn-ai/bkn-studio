/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useState } from "react";

import {
  buildAuditUserDirectory,
  formatAuditUserDisplay,
} from "@/modules/execution-factory-lab/utils/audit-user-display";
import { getUser, listUsers } from "@/modules/system-admin/services/admin.service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function useAccountDirectory() {
  const [directory, setDirectory] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    void listUsers({ skipErrorToast: true })
      .then((users) => {
        setDirectory(buildAuditUserDirectory(users));
      })
      .catch(() => {
        setDirectory(new Map());
      });
  }, []);

  return directory;
}

export function resolveUpdaterDisplayName(
  updaterName: string | undefined,
  directory: Map<string, string>,
  emptyLabel = "--",
) {
  const display = formatAuditUserDisplay({
    id: updaterName,
    directory,
  });

  return display === "-" ? emptyLabel : display;
}

export function useResolvedUpdaterName(updaterName?: string, emptyLabel = "--") {
  const directory = useAccountDirectory();
  const [resolved, setResolved] = useState(emptyLabel);

  useEffect(() => {
    const trimmed = updaterName?.trim();
    if (!trimmed || trimmed === "--" || trimmed === "-") {
      setResolved(emptyLabel);
      return;
    }

    const fromDirectory = resolveUpdaterDisplayName(trimmed, directory, "");
    if (fromDirectory) {
      setResolved(fromDirectory);
      return;
    }

    if (!UUID_PATTERN.test(trimmed)) {
      setResolved(trimmed);
      return;
    }

    let cancelled = false;
    void getUser(trimmed)
      .then((user) => {
        if (cancelled) {
          return;
        }

        setResolved(user.name?.trim() || user.account?.trim() || emptyLabel);
      })
      .catch(() => {
        if (!cancelled) {
          setResolved(emptyLabel);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [directory, emptyLabel, updaterName]);

  return resolved;
}
