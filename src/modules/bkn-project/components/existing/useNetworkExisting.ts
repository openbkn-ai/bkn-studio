/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useState } from "react";

import { getExistingDefinitions } from "@/modules/bkn-project/services/draft.service";
import { getExistingIndex } from "@/modules/bkn-project/services/publish.service";
import { getNetworkBackground } from "@/modules/bkn-project/services/requirements.service";
import type { ExistingDefinitions } from "@/modules/bkn-project/types/draft";
import type { ProjectIndex } from "@/modules/bkn-project/types/publish";
import { getKnowledgeNetworkStatistics } from "@/modules/knowledge-network/services/network.service";
import type { KnowledgeNetworkStatistics } from "@/modules/knowledge-network/types/network";

/** What the project's network already had, beside what the project adds. */
export type NetworkExisting = {
  /** The network's object and relation types, as the project's branch has them. */
  definitions: ExistingDefinitions;
  objectTypeIds: Set<string>;
  relationTypeIds: Set<string>;
  /** The network's counts, for its kinetic items; null when they cannot be read. */
  statistics: KnowledgeNetworkStatistics | null;
  /** The indexes of the existing object types' tables; null when they cannot be read. */
  index: ProjectIndex | null;
  /** Whether the network has a description or SKILL.md the project reads as background. */
  background: boolean;
};

/**
 * Reads what the project's network already has. null while read, on a new network, and when it
 * cannot be read: the page then shows exactly what it shows for a new network.
 */
export function useNetworkExisting(projectId: string, networkId: string): NetworkExisting | null {
  const [existing, setExisting] = useState<NetworkExisting | null>(null);
  useEffect(() => {
    let active = true;
    setExisting(null);
    void (async () => {
      const definitions = await getExistingDefinitions(projectId).catch(() => null);
      if (!definitions || definitions.objectTypes.length + definitions.relationTypes.length === 0) {
        return;
      }
      const [statistics, index, background] = await Promise.all([
        getKnowledgeNetworkStatistics(networkId).catch(() => null),
        getExistingIndex(projectId).catch(() => null),
        getNetworkBackground(projectId).catch(() => null),
      ]);
      if (active) {
        setExisting({
          background: Boolean(background),
          definitions,
          index,
          objectTypeIds: new Set(definitions.objectTypes.map((item) => item.id)),
          relationTypeIds: new Set(definitions.relationTypes.map((item) => item.id)),
          statistics,
        });
      }
    })();
    return () => {
      active = false;
    };
  }, [networkId, projectId]);
  return existing;
}
