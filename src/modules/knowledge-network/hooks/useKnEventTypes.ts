/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { listKnEventTypes } from "@/modules/knowledge-network/services/event-type.service";
import type { KnEventType } from "@/modules/knowledge-network/types/event-type";

export type KnEventTypesState = {
  /** False while loading, and when the network's event types cannot be read (older backend, no permission). */
  available: boolean;
  /** Event types by the ID of their event class; a type without a class is not in it. */
  byClassId: ReadonlyMap<string, KnEventType>;
  loading: boolean;
  reload: () => void;
  types: readonly KnEventType[];
};

/** The event types of a network, read once and again on `reload` or when `refreshKey` changes. */
export function useKnEventTypes(networkId: string, refreshKey: unknown = 0): KnEventTypesState {
  const [types, setTypes] = useState<KnEventType[]>([]);
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(Boolean(networkId));
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!networkId) {
      setTypes([]);
      setAvailable(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void listKnEventTypes(networkId)
      .then((entries) => {
        if (cancelled) return;
        setTypes(entries);
        setAvailable(true);
      })
      .catch(() => {
        // Without the event module the network simply has no event entry.
        if (cancelled) return;
        setTypes([]);
        setAvailable(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [networkId, refreshKey, tick]);

  const byClassId = useMemo(
    () =>
      new Map(
        types.flatMap((type) =>
          type.object_type_id ? [[type.object_type_id, type] as const] : [],
        ),
      ),
    [types],
  );
  const reload = useCallback(() => setTick((current) => current + 1), []);

  return { available, byClassId, loading, reload, types };
}
