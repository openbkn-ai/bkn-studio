/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useRef, useState } from "react";

import { listKnowledgeNetworkActionTypePage } from "@/modules/knowledge-network/services/action-type.service";
import {
  getKnowledgeNetworkObjectTypeDetail,
  listKnowledgeNetworkObjectTypePage,
} from "@/modules/knowledge-network/services/object-type.service";
import { listKnowledgeNetworkRelationTypePage } from "@/modules/knowledge-network/services/relation-type.service";
import type { KnowledgeNetworkObjectTypeRecord } from "@/modules/knowledge-network/types/knowledge-network";

const GRAPH_OBJECT_PAGE_SIZE = 10;
const COUNT_CONCURRENCY = 4;

type ResourceScope = "relations" | "actions";

type Params = {
  direction: "asc" | "desc";
  enabled: boolean;
  keyword: string;
  networkId: string;
  refreshVersion: number;
  resourceScope: ResourceScope;
  selectedId: string;
  setSelectedId: (id: string) => void;
  sort: "name" | "update_time";
};

export function useObjectTypeGraphExplorer({
  direction,
  enabled,
  keyword,
  networkId,
  refreshVersion,
  resourceScope,
  selectedId,
  setSelectedId,
  sort,
}: Params) {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<KnowledgeNetworkObjectTypeRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<KnowledgeNetworkObjectTypeRecord | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [resourceCounts, setResourceCounts] = useState<Record<string, number | null>>({});
  const countCache = useRef(new Map<string, number | null>());
  const countRequests = useRef(new Set<string>());
  const countRequestScope = useRef("");

  useEffect(() => {
    countRequestScope.current = `${networkId}\0${resourceScope}\0${refreshVersion}`;
    countCache.current.clear();
    setResourceCounts({});
    return () => {
      countRequestScope.current = "";
    };
  }, [networkId, refreshVersion, resourceScope]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    void listKnowledgeNetworkObjectTypePage(networkId, {
      direction,
      limit: GRAPH_OBJECT_PAGE_SIZE,
      namePattern: keyword,
      offset: (page - 1) * GRAPH_OBJECT_PAGE_SIZE,
      sort,
    })
      .then((result) => {
        if (cancelled) return;
        const maxPage = Math.max(1, Math.ceil(result.totalCount / GRAPH_OBJECT_PAGE_SIZE));
        if (page > maxPage) {
          setItems([]);
          setTotalCount(result.totalCount);
          setPage(maxPage);
          return;
        }
        setItems(result.entries);
        setTotalCount(result.totalCount);
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setTotalCount(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [direction, enabled, keyword, networkId, page, refreshVersion, sort]);

  useEffect(() => {
    setPage(1);
  }, [keyword, networkId]);

  useEffect(() => {
    if (!enabled || items.length === 0) {
      setResourceCounts({});
      return;
    }
    let active = true;
    const requestScope = `${networkId}\0${resourceScope}\0${refreshVersion}`;
    const countKey = (id: string) => `${networkId}\0${resourceScope}\0${id}`;
    const pending = items.filter(
      (item) =>
        !countCache.current.has(countKey(item.id)) &&
        !countRequests.current.has(`${requestScope}\0${item.id}`),
    );
    setResourceCounts(
      Object.fromEntries(
        items
          .filter((item) => countCache.current.has(countKey(item.id)))
          .map((item) => [item.id, countCache.current.get(countKey(item.id))!]),
      ),
    );

    let nextIndex = 0;
    async function loadCounts() {
      while (active && nextIndex < pending.length) {
        const item = pending[nextIndex++];
        const requestKey = `${requestScope}\0${item.id}`;
        countRequests.current.add(requestKey);
        let count: number | null = null;
        try {
          const result =
            resourceScope === "relations"
              ? await listKnowledgeNetworkRelationTypePage(networkId, {
                  boundObjectTypeId: item.id,
                  limit: 1,
                  offset: 0,
                })
              : await listKnowledgeNetworkActionTypePage(networkId, {
                  limit: 1,
                  objectTypeId: item.id,
                  offset: 0,
                });
          count = result.totalCount;
        } catch {
          // A failed count must remain distinct from an actual zero.
        } finally {
          countRequests.current.delete(requestKey);
        }
        if (active && countRequestScope.current === requestScope) {
          countCache.current.set(countKey(item.id), count);
          setResourceCounts((current) => ({ ...current, [item.id]: count }));
        }
      }
    }
    for (let worker = 0; worker < Math.min(COUNT_CONCURRENCY, pending.length); worker += 1) {
      void loadCounts();
    }
    return () => {
      active = false;
    };
  }, [enabled, items, networkId, refreshVersion, resourceScope]);

  useEffect(() => {
    if (!enabled || loading) return;
    const selectedFromPage = items.find((item) => item.id === selectedId);
    if (selectedFromPage) {
      setSelected(selectedFromPage);
      setSelectedLoading(false);
      return;
    }
    if (!selectedId) {
      const first = items[0];
      setSelected(first ?? null);
      setSelectedId(first?.id ?? "");
      setSelectedLoading(false);
      return;
    }
    if (selected?.id === selectedId) return;

    let cancelled = false;
    setSelectedLoading(true);
    void getKnowledgeNetworkObjectTypeDetail(networkId, selectedId)
      .then((result) => {
        if (cancelled) return;
        if (result) {
          setSelected(result);
          return;
        }
        const first = items[0];
        setSelected(first ?? null);
        setSelectedId(first?.id ?? "");
      })
      .catch(() => {
        if (cancelled) return;
        const first = items[0];
        setSelected(first ?? null);
        setSelectedId(first?.id ?? "");
      })
      .finally(() => {
        if (!cancelled) setSelectedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, items, loading, networkId, selected, selectedId, setSelectedId]);

  return {
    items,
    loading,
    page,
    pageSize: GRAPH_OBJECT_PAGE_SIZE,
    resourceCounts,
    selected,
    selectedLoading,
    setPage,
    setSelected,
    totalCount,
  };
}
