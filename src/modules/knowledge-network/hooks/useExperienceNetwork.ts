/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useState } from "react";

import { getKnowledgeNetwork } from "@/modules/knowledge-network/services/knowledge-network.service";

export type ExperienceNetworkIdentity = {
  id: string;
  name: string;
  slug: string;
};

/**
 * Resolves the network identity needed by Context Loader.
 *
 * A workspace passes its already loaded identity (including `null` while loading), so the
 * embedded experience does not issue a second knowledge-network detail request. Standalone
 * consumers omit the value and keep the self-loading behavior.
 */
export function useExperienceNetwork(
  networkId: string,
  providedNetwork?: ExperienceNetworkIdentity | null,
) {
  const [resolvedNetwork, setResolvedNetwork] =
    useState<ExperienceNetworkIdentity | null>(providedNetwork ?? null);

  useEffect(() => {
    if (providedNetwork !== undefined) {
      setResolvedNetwork(
        providedNetwork?.id === networkId ? providedNetwork : null,
      );
      return undefined;
    }

    if (!networkId) {
      setResolvedNetwork(null);
      return undefined;
    }

    setResolvedNetwork(null);
    let cancelled = false;
    void getKnowledgeNetwork(networkId)
      .then((record) => {
        if (!cancelled) {
          setResolvedNetwork(
            record
              ? { id: record.id, name: record.name, slug: record.identifier }
              : null,
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedNetwork(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [networkId, providedNetwork]);

  return resolvedNetwork;
}
