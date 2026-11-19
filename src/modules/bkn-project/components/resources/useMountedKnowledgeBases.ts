/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useState } from "react";

import { useBknProjectKbMode } from "@/framework/entitlement/bkn-project-kb-mode";
import { listKnowledgeNetworkCapabilities } from "@/modules/knowledge-network/services/capability-binding.service";

/**
 * The names of the knowledge bases mounted on the project's network, which are the project's
 * sources as its catalogs are. Empty where the edition has no knowledge bases; undefined while
 * they are read.
 */
export function useMountedKnowledgeBases(knId: string | undefined): string[] | undefined {
  const kbMode = useBknProjectKbMode();
  const [names, setNames] = useState<{ knId: string; names: string[] } | null>(null);
  useEffect(() => {
    if (kbMode !== "enabled" || !knId) {
      return undefined;
    }
    let active = true;
    listKnowledgeNetworkCapabilities(knId, {
      limit: 100,
      mountedOnly: true,
      type: "knowledge_base",
    })
      .then(
        (result) =>
          active &&
          setNames({ knId, names: result.entries.map((item) => item.name || item.capabilityId) }),
      )
      .catch(() => active && setNames({ knId, names: [] }));
    return () => {
      active = false;
    };
  }, [kbMode, knId]);
  if (kbMode !== "enabled" || !knId) {
    return [];
  }
  return names?.knId === knId ? names.names : undefined;
}
