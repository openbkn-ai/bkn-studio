/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { CatalogRecord } from "@/shared/catalog/types";
import type { DataConnectConnectorType } from "../types/data-connect";

export function supportsCatalogDiscovery(
  catalog: Pick<CatalogRecord, "type" | "connectorType">,
  connectorTypes: DataConnectConnectorType[],
): boolean {
  // Logical catalogs follow their own discovery flow without a connector.
  if (catalog.type === "logical") return true;
  const connector = connectorTypes.find((type) => type.type === catalog.connectorType);
  return connector?.supportDiscover === true && connector.available && connector.enabled;
}
