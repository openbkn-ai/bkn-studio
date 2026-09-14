/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Spin } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { TableSurface } from "@/framework/ui/common/TableSurface";
import { listCatalogResourcePage } from "@/modules/data-catalog/services/resource.service";
import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";

type AuthorizedResourceListPanelProps = {
  catalogId: string;
  onOpenResource: (resourceId: string) => void;
};

// This view intentionally has no Catalog model. The server has established
// which child resources are visible; no parent name, type, state, or
// configuration is invented on the client.
export function AuthorizedResourceListPanel({
  catalogId,
  onOpenResource,
}: AuthorizedResourceListPanelProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<CatalogResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listCatalogResourcePage({ catalogId, limit: 100, offset: 0 })
      .then((page) => {
        if (!cancelled) setItems(page.items);
      })
      .catch((requestError) => {
        if (!cancelled) setError(extractRequestErrorMessage(requestError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [catalogId, reloadKey]);

  const columns: ColumnsType<CatalogResource> = [
    {
      dataIndex: "name",
      title: t("dataCatalog.resource.name"),
      render: (_value, resource) => (
        <AppButton onClick={() => onOpenResource(resource.id)} type="link">
          {resource.name || resource.sourceIdentifier || "-"}
        </AppButton>
      ),
    },
    {
      dataIndex: "category",
      title: t("dataCatalog.resource.category"),
      render: (category: CatalogResource["category"]) => t(`dataCatalog.categories.${category}`),
    },
  ];

  return (
    <TableSurface>
      {loading ? <Spin /> : error ? (
        <Alert
          action={<AppButton onClick={() => setReloadKey((value) => value + 1)} type="link">{t("common.retry")}</AppButton>}
          message={error}
          showIcon
          type="error"
        />
      ) : items.length === 0 ? (
        <EmptyStatePanel description="" title={t("dataCatalog.resource.noMatch")} />
      ) : <AppTable columns={columns} dataSource={items} pagination={false} rowKey="id" />}
    </TableSurface>
  );
}
