/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ExclamationCircleOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { AppTable } from "@/framework/ui/common/AppTable";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { TableSurface } from "@/framework/ui/common/TableSurface";
import { resourceGateOf } from "@/modules/data-catalog/lib/index-state";
import type { CatalogResource, ResourceSchemaField } from "@/modules/data-catalog/types/data-catalog";
import type { CatalogRecord } from "@/shared/catalog";

import styles from "./ResourceDetailPanel.module.css";

type ResourceDetailPanelProps = {
  catalog: CatalogRecord | null;
  resource: CatalogResource;
};

export function ResourceDetailPanel({ catalog, resource }: ResourceDetailPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [schemaPage, setSchemaPage] = useState(1);
  const [schemaPageSize, setSchemaPageSize] = useState(10);

  const gate = resourceGateOf(catalog);

  useEffect(() => {
    setSchemaPage(1);
  }, [resource.id]);

  const pagedSchema = useMemo(() => {
    const start = (schemaPage - 1) * schemaPageSize;
    return resource.schema.slice(start, start + schemaPageSize);
  }, [resource.schema, schemaPage, schemaPageSize]);

  const schemaColumns: ColumnsType<ResourceSchemaField> = [
    {
      dataIndex: "name",
      title: t("dataCatalog.resource.fieldName"),
    },
    {
      dataIndex: "displayName",
      title: t("dataCatalog.resource.fieldDisplayName"),
      render: (value: string | undefined) => value || "—",
    },
    {
      dataIndex: "type",
      title: t("dataCatalog.resource.fieldType"),
    },
    {
      dataIndex: "description",
      title: t("dataCatalog.resource.fieldDescription"),
      render: (value: string | undefined) => (
        <span className={styles.fieldDescription} title={value}>
          {value || "—"}
        </span>
      ),
    },
  ];

  return (
    <div className={styles.contentSurface}>
      {!gate.ok && catalog ? (
        <div className={styles.calloutWarn}>
          <ExclamationCircleOutlined />
          <span>
            {t("dataCatalog.gate.catalogDisabled", { name: catalog.name })}{" "}
            <button
              className={styles.textLink}
              onClick={() => {
                void navigate("/data-connect");
              }}
              type="button"
            >
              {t("dataCatalog.gate.goEnable")}
            </button>
          </span>
        </div>
      ) : null}

      <div className={styles.sectionCard}>
        <h3 className={styles.sectionTitle}>{t("common.basicInfo")}</h3>
        <div className={styles.basicInfo}>
          <p className={styles.basicInfoRow}>
            <span className={styles.basicInfoLabel}>
              {t("dataCatalog.resource.basicName")}：
            </span>
            <span>{resource.name}</span>
            <span className={styles.basicInfoDivider}>·</span>
            <span className={styles.basicInfoLabel}>ID：</span>
            <span>{resource.id}</span>
          </p>
          <p className={styles.basicInfoRow}>
            <span className={styles.basicInfoLabel}>
              {t("dataCatalog.resource.description")}：
            </span>
            <span>{resource.description || "—"}</span>
          </p>
        </div>
      </div>

      <div className={styles.sectionCard}>
        <h3 className={styles.sectionTitle}>{t("dataCatalog.resource.schemaSection")}</h3>
        <TableSurface className={styles.tableSurface}>
          <AppTable<ResourceSchemaField>
            columns={schemaColumns}
            dataSource={pagedSchema}
            locale={{ emptyText: t("dataCatalog.resource.schemaEmpty") }}
            pagination={false}
            rowKey="name"
          />
        </TableSurface>
        {resource.schema.length > 0 ? (
          <TablePaginationBar
            current={schemaPage}
            onChange={(nextPage, nextPageSize) => {
              setSchemaPage(nextPage);
              setSchemaPageSize(nextPageSize);
            }}
            pageSize={schemaPageSize}
            showSizeChanger
            showTotal={(count) => t("common.total", { total: count })}
            total={resource.schema.length}
          />
        ) : null}
      </div>
    </div>
  );
}
