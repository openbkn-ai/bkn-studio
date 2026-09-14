/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useMemo, useState } from "react";

import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import { hasPermissions } from "@/framework/permission/has-permissions";
import { dataCatalogResourceStatusPermissions } from "@/modules/data-catalog/permissions";
import { getCatalogResources } from "@/modules/data-catalog/services/resource.service";
import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";

/** Load Resource-owned local-index availability for a deduplicated set of resource ids. */
export function useResourceIndexStates(resourceIds: Array<string | undefined>) {
  const runtimeConfig = useRuntimeConfig();
  const canLoadResourceIndexStates = hasPermissions({
    currentPermissions: runtimeConfig.currentUser.permissions,
    mode: "any",
    requiredPermissions: [...dataCatalogResourceStatusPermissions],
  });
  const boundResourceIds = useMemo(
    () =>
      Array.from(new Set(resourceIds.filter((id): id is string => Boolean(id)))),
    [resourceIds],
  );

  const [resources, setResources] = useState<CatalogResource[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!canLoadResourceIndexStates || boundResourceIds.length === 0) {
      setResources([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    void getCatalogResources(boundResourceIds)
      .then((items) => {
        if (!cancelled) {
          setResources(items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResources([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [boundResourceIds, canLoadResourceIndexStates]);

  const localIndexStatusByResourceId = useMemo(() => {
    const next = new Map<string, CatalogResource["localIndexStatus"]>();
    resources.forEach((resource) => {
      next.set(resource.id, resource.localIndexStatus);
    });
    return next;
  }, [resources]);

  return { canLoadResourceIndexStates, loading, localIndexStatusByResourceId };
}
