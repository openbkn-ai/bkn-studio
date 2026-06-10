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
