import { useSearchParams } from "react-router-dom";

import { DataConnectScanScene } from "@/modules/data-connect/scenes/DataConnectScanScene";

export function DataConnectScanPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const catalogId = searchParams.get("catalogId") ?? undefined;

  return (
    <DataConnectScanScene
      catalogId={catalogId}
      onCatalogIdChange={(nextCatalogId) => {
        const nextParams = new URLSearchParams(searchParams);

        if (nextCatalogId) {
          nextParams.set("catalogId", nextCatalogId);
        } else {
          nextParams.delete("catalogId");
        }

        setSearchParams(nextParams, { replace: true });
      }}
    />
  );
}
