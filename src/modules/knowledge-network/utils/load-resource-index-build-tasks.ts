/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { listBuildTasks } from "@/modules/data-catalog/services/build-task.service";
import { getCatalogResources } from "@/modules/data-catalog/services/resource.service";
import type { BuildTask } from "@/modules/data-catalog/types/data-catalog";

export function uniqueCatalogIdsFromResourceCatalogMap(
  resourceCatalogById: Map<string, string | undefined>,
) {
  return Array.from(
    new Set(
      [...resourceCatalogById.values()].filter((catalogId): catalogId is string =>
        Boolean(catalogId),
      ),
    ),
  );
}

export async function loadResourceIndexBuildTasks(
  resourceIds: string[],
): Promise<BuildTask[]> {
  const boundResourceIds = Array.from(new Set(resourceIds.filter(Boolean)));
  if (boundResourceIds.length === 0) {
    return [];
  }

  const resourceIdSet = new Set(boundResourceIds);
  const resources = await getCatalogResources(boundResourceIds);
  const resourceCatalogById = new Map(resources.map((resource) => [resource.id, resource.catalogId]));
  const catalogIds = uniqueCatalogIdsFromResourceCatalogMap(resourceCatalogById);
  const unresolvedResourceIds = boundResourceIds.filter((resourceId) => {
    const catalogId = resourceCatalogById.get(resourceId);
    return !catalogId;
  });

  const [catalogTaskGroups, fallbackTaskGroups] = await Promise.all([
    Promise.all(catalogIds.map((catalogId) => listBuildTasks({ catalogId, silent: true }))),
    unresolvedResourceIds.length > 0
      ? Promise.all(
          unresolvedResourceIds.map((resourceId) =>
            listBuildTasks({ resourceId, silent: true }),
          ),
        )
      : Promise.resolve([]),
  ]);

  return [...catalogTaskGroups.flat(), ...fallbackTaskGroups.flat()].filter((task) =>
    resourceIdSet.has(task.resourceId),
  );
}
