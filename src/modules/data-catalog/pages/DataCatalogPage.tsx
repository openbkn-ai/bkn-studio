/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Navigate, Outlet, useParams } from "react-router-dom";

import { DEFAULT_APP_ENTRY_PATH } from "@/app/router/app-paths";
import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import { hasPermissions } from "@/framework/permission/has-permissions";
import { catalogDetailPermissions } from "@/modules/data-catalog/permissions";
import { DataCatalogScene } from "@/modules/data-catalog/scenes/DataCatalogScene";

export function DataCatalogPage() {
  const params = useParams<{ catalogId?: string }>();
  const routeCatalogId = params.catalogId?.trim();
  const runtimeConfig = useRuntimeConfig();
  const canViewCatalogDetail = hasPermissions({
    currentPermissions: runtimeConfig.currentUser.permissions,
    mode: "any",
    requiredPermissions: catalogDetailPermissions,
  });

  if (routeCatalogId && !canViewCatalogDetail) {
    return <Navigate replace to={DEFAULT_APP_ENTRY_PATH} />;
  }

  return (
    <>
      <DataCatalogScene
        selection={routeCatalogId ? { id: routeCatalogId, type: "catalog" } : null}
        suppressAutoSelect={!routeCatalogId}
      />
      <Outlet />
    </>
  );
}
