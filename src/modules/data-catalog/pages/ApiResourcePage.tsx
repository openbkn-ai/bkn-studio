/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ApiResourceScene } from "../scenes/ApiResourceScene";

export function ApiResourcePage({ edit = false }: { edit?: boolean }) {
  const { resourceId, catalogId } = useParams<{ resourceId: string; catalogId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "preview" ? "preview" : "detail";
  const detailPath = resourceId
    ? `/data-catalog/api-resource/${encodeURIComponent(resourceId)}`
    : undefined;
  return (
    <ApiResourceScene
      key={`${resourceId ?? catalogId}:${edit ? "edit" : "default"}`}
      resourceId={resourceId}
      catalogId={catalogId}
      startInEditMode={edit}
      tab={tab}
      onTabChange={(nextTab) => {
        const nextParams = new URLSearchParams(searchParams);
        if (nextTab === "preview") nextParams.set("tab", nextTab);
        else nextParams.delete("tab");
        setSearchParams(nextParams, { replace: true });
      }}
      onEdit={detailPath ? () => void navigate(`${detailPath}/edit`) : undefined}
      onBack={(parentCatalogId = catalogId) => {
        if (edit && detailPath) {
          void navigate(detailPath);
          return;
        }
        void navigate(
          parentCatalogId
            ? `/data-catalog/catalog/${encodeURIComponent(parentCatalogId)}`
            : "/data-catalog",
        );
      }}
      onSaveCommitted={(id) => {
        void navigate(`/data-catalog/api-resource/${encodeURIComponent(id)}`, { replace: true });
      }}
      onDeleted={(id) => void navigate(`/data-catalog/catalog/${encodeURIComponent(id)}`)}
    />
  );
}
