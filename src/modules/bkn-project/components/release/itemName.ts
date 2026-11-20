/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";
import type { ReleaseItem } from "@/modules/bkn-project/types/release";

const KEY = "bknProject.release.publish";

/**
 * How an object type or relation type of a release reads: its name; a relation with the object
 * types it joins when they are known, since several may share a name; an item the model no longer
 * has, never by its id.
 */
export function releaseItemName(
  t: TFunction,
  item: Pick<ReleaseItem, "name" | "source_name" | "target_name">,
) {
  const name = item.name || t(`${KEY}.removedItem`);
  return item.source_name && item.target_name
    ? t(`${KEY}.relationEnds`, { name, source: item.source_name, target: item.target_name })
    : name;
}
