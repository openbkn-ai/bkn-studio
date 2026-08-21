/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useMemo, useState } from "react";

import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import { hasPermissions } from "@/framework/permission/has-permissions";
import type { BuildTask } from "@/modules/data-catalog/types/data-catalog";
import { loadResourceIndexBuildTasks } from "@/modules/knowledge-network/utils/load-resource-index-build-tasks";

/** Load data-catalog index build tasks for a deduplicated set of resource ids. */
export function useResourceIndexStates(resourceIds: Array<string | undefined>) {
  const runtimeConfig = useRuntimeConfig();
  const canLoadResourceIndexStates = hasPermissions({
    currentPermissions: runtimeConfig.currentUser.permissions,
    mode: "any",
    requiredPermissions: ["resource:view_detail", "catalog:task_manage"],
  });
  const boundResourceIds = useMemo(
    () =>
      Array.from(new Set(resourceIds.filter((id): id is string => Boolean(id)))),
    [resourceIds],
  );

  const [resourceBuildTasks, setResourceBuildTasks] = useState<BuildTask[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!canLoadResourceIndexStates || boundResourceIds.length === 0) {
      setResourceBuildTasks([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    void loadResourceIndexBuildTasks(boundResourceIds)
      .then((tasks) => {
        if (!cancelled) {
          setResourceBuildTasks(tasks);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResourceBuildTasks([]);
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

  const buildTasksByResourceId = useMemo(() => {
    const next = new Map<string, BuildTask[]>();
    resourceBuildTasks.forEach((task) => {
      next.set(task.resourceId, [...(next.get(task.resourceId) ?? []), task]);
    });
    return next;
  }, [resourceBuildTasks]);

  return { buildTasksByResourceId, canLoadResourceIndexStates, loading };
}
