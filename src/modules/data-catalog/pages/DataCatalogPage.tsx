/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useParams } from "react-router-dom";

import { DataCatalogScene } from "@/modules/data-catalog/scenes/DataCatalogScene";

type DataCatalogPageProps = {
  selectionType?: "catalog" | "resource";
};

export function DataCatalogPage({ selectionType }: DataCatalogPageProps) {
  const params = useParams<{ catalogId?: string; resourceId?: string }>();

  const selection =
    selectionType === "catalog" && params.catalogId
      ? ({ id: params.catalogId, type: "catalog" } as const)
      : selectionType === "resource" && params.resourceId
        ? ({ id: params.resourceId, type: "resource" } as const)
        : null;

  return <DataCatalogScene selection={selection} />;
}
