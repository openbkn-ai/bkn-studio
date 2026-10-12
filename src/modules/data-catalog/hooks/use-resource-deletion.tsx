/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Space } from "antd";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import {
  deleteCatalogResource,
  getCatalogResource,
} from "@/modules/data-catalog/services/resource.service";
import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";
import { hasCatalogResourceOperation } from "@/modules/data-catalog/utils/resource-operations";
import type { CatalogRecord } from "@/shared/catalog";

export function isResourceDeletionEligible(resource: CatalogResource) {
  if (!hasCatalogResourceOperation(resource, "delete")) {
    return false;
  }
  if (resource.category === "dataset" || resource.category === "logical_view") {
    return true;
  }
  return resource.status === "stale" && resource.lastDiscoverStatus === "missing";
}

export function useResourceDeletion() {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();

  const confirmDeleteResource = (
    record: CatalogResource,
    catalog: CatalogRecord,
    onDeleted: () => void,
  ) => {
    void modal.confirm({
      title: t("dataCatalog.resource.deleteTitle"),
      content: (
        <Space direction="vertical">
          <div>
            {t("dataCatalog.resource.name")}: {record.name}
          </div>
          <div>
            {t("dataCatalog.resource.schemaName")}: {record.schemaName || "-"}
          </div>
          <div>
            {t("dataCatalog.resource.catalog")}: {catalog.name}
          </div>
          <div>
            {t("dataCatalog.resource.resourceStatus")}:{" "}
            {record.status ? t(`dataCatalog.resourceStatuses.${record.status}`) : "-"}
          </div>
          {record.category === "table" || record.category === "index" ? (
            <div>
              {t("dataCatalog.resource.discoverStatus")}:{" "}
              {record.lastDiscoverStatus
                ? t(`dataCatalog.discoverStatuses.${record.lastDiscoverStatus}`)
                : "-"}
            </div>
          ) : null}
          <div>{t("dataCatalog.resource.deleteImpact")}</div>
          <div>{t("dataCatalog.resource.deleteUnknownReferences")}</div>
        </Space>
      ),
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const latest = await getCatalogResource(record.id);
          if (!latest || latest.catalogId !== catalog.id || !isResourceDeletionEligible(latest)) {
            throw new Error(t("dataCatalog.resource.deleteStateChanged"));
          }
          await deleteCatalogResource(record.id, {
            onlyIfStale: latest.category !== "dataset" && latest.category !== "logical_view",
            skipErrorToast: true,
          });
          message.success(t("dataCatalog.resource.deleted", { name: record.name }));
          onDeleted();
        } catch (error) {
          void message.error(extractRequestErrorMessage(error));
          throw error;
        }
      },
    });
  };

  return { confirmDeleteResource };
}
