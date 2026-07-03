/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useState } from "react";

import { listUsers } from "@/modules/system-admin/services/admin.service";
import { buildAuditUserDirectory } from "@/modules/execution-factory/utils/audit-user-display";

export function useAuditUserDirectory() {
  const [directory, setDirectory] = useState<Map<string, string>>(() => new Map());

  useEffect(() => {
    let active = true;

    listUsers({ skipErrorToast: true })
      .then((users) => {
        if (active) {
          setDirectory(buildAuditUserDirectory(users));
        }
      })
      .catch(() => {
        if (active) {
          setDirectory(new Map());
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return directory;
}
