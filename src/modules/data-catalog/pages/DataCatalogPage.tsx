/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useParams } from "react-router-dom";

import { DataCatalogScene } from "@/modules/data-catalog/scenes/DataCatalogScene";

type DataCatalogPageProps = {
  selectionType?: "catalog";
};

export function DataCatalogPage({ selectionType }: DataCatalogPageProps) {
  const params = useParams<{ catalogId?: string }>();
  const routeCatalogId = params.catalogId?.trim();
  const selection =
    selectionType === "catalog" && routeCatalogId
      ? ({ id: routeCatalogId, type: "catalog" } as const)
      : null;
  const suppressAutoSelect = selectionType !== "catalog";

  return (
    <DataCatalogScene
      selection={selection}
      suppressAutoSelect={suppressAutoSelect}
    />
  );
}
