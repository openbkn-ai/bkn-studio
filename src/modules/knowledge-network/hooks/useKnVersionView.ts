/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";

import {
  ensureKnVersionContext,
  getKnVersionView,
  isKnVersioned,
  setKnVersionView,
  subscribeKnVersionContext,
} from "@/modules/knowledge-network/services/shared/kn-version-context";
import type { KnVersionView } from "@/modules/knowledge-network/types/kn-version";

/** Whether the network has versioning, asking the backend the first time it is needed. */
export function useKnVersioned(networkId: string): boolean {
  useEffect(() => {
    if (networkId) {
      void ensureKnVersionContext(networkId);
    }
  }, [networkId]);

  return useSyncExternalStore(subscribeKnVersionContext, () =>
    networkId ? isKnVersioned(networkId) : false,
  );
}

/** The version of a network being viewed (always "running" without versioning), and its setter. */
export function useKnVersionView(networkId: string) {
  const view: KnVersionView = useSyncExternalStore(subscribeKnVersionContext, () =>
    networkId ? getKnVersionView(networkId) : "running",
  );
  const setView = useCallback(
    (next: KnVersionView) => {
      if (networkId) {
        setKnVersionView(networkId, next);
      }
    },
    [networkId],
  );

  return [view, setView] as const;
}
