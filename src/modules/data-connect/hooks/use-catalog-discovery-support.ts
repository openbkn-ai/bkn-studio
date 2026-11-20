/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useState } from "react";
import type { CatalogRecord } from "@/shared/catalog/types";
import { supportsCatalogDiscovery } from "../lib/catalog-discovery";
import { listDataConnectConnectorTypes } from "../services/data-connect.service";
import type { DataConnectConnectorType } from "../types/data-connect";

export function useCatalogDiscoverySupport(
  catalog: Pick<CatalogRecord, "type" | "connectorType"> | null,
  enabled: boolean,
): boolean {
  const [types, setTypes] = useState<DataConnectConnectorType[]>([]);
  const needsConnectorTypes = enabled && !!catalog?.connectorType && catalog.type !== "logical";
  useEffect(() => {
    if (!needsConnectorTypes) return;
    let active = true;
    void listDataConnectConnectorTypes({ skipErrorToast: true })
      .then((items) => {
        if (active) setTypes(items);
      })
      .catch(() => {
        if (active) setTypes([]);
      });
    return () => {
      active = false;
    };
  }, [needsConnectorTypes]);

  return enabled && !!catalog && supportsCatalogDiscovery(catalog, types);
}
