/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ExclamationCircleOutlined } from "@ant-design/icons";
import { Alert, Spin, Tooltip } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { formatCount } from "@/modules/data-catalog/lib/format";
import { previewCatalogResource } from "@/modules/data-catalog/services/resource.service";
import type {
  CatalogResource,
  ResourcePreviewResult,
  ResourceSchemaField,
} from "@/modules/data-catalog/types/data-catalog";

import styles from "./ResourcePreviewPanel.module.css";

type ResourcePreviewPanelProps = {
  active: boolean;
  disabled?: boolean;
  disabledMessage?: string;
  resource: CatalogResource;
};

const DEFAULT_PAGE_SIZE = 10;

function isNumericType(type: string) {
  const lowered = type.toLowerCase();
  return (
    lowered.startsWith("int") ||
    lowered.startsWith("bigint") ||
    lowered.startsWith("decimal") ||
    lowered.startsWith("numeric") ||
    lowered.startsWith("float") ||
    lowered.startsWith("double")
  );
}

function formatPreviewCell(value: unknown) {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "";
  }
}

function resolvePreviewColumnHead(field: ResourceSchemaField) {
  const technicalName = field.name;
  const businessName = field.displayName?.trim();
  const hasDistinctBusinessName = Boolean(
    businessName && businessName !== technicalName,
  );

  return {
    primary: hasDistinctBusinessName ? businessName! : technicalName,
    secondary: hasDistinctBusinessName ? technicalName : undefined,
    type: field.type,
    tooltip: field.description?.trim() || undefined,
  };
}

export function ResourcePreviewPanel({
  active,
  disabled = false,
  disabledMessage,
  resource,
}: ResourcePreviewPanelProps) {
  const { t } = useTranslation();
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ResourcePreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextOffset: number, nextLimit: number) => {
      setLoading(true);
      setError(null);
      try {
        const data = await previewCatalogResource(resource.id, {
          limit: nextLimit,
          offset: nextOffset,
        });
        setResult(data);
      } catch (loadError) {
        setError(extractRequestErrorMessage(loadError));
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [resource.id],
  );

  useEffect(() => {
    if (!active || disabled) {
      return;
    }
    setPage(1);
    setPageSize(DEFAULT_PAGE_SIZE);
    void load(0, DEFAULT_PAGE_SIZE);
  }, [active, disabled, load, resource.id]);

  const offset = (page - 1) * pageSize;

  if (disabled) {
    return (
      <div className={styles.gatePanel}>
        <ExclamationCircleOutlined />
        <span>{disabledMessage ?? t("dataCatalog.gate.catalogDisabledShort")}</span>
      </div>
    );
  }

  const backendTotal = result?.total ?? 0;
  const rows = result?.rows ?? [];
  const fetched = offset + rows.length;
  const totalUnreliable = rows.length === pageSize && backendTotal <= fetched;
  const total = totalUnreliable
    ? Math.max(backendTotal, resource.rowCount, fetched)
    : Math.max(backendTotal, fetched);
  const columns =
    resource.schema.length > 0
      ? resource.schema
      : rows.length > 0
        ? Object.keys(rows[0]).map((name) => ({ name, type: "string" }))
        : [];

  const handlePaginationChange = (nextPage: number, nextPageSize: number) => {
    const resolvedPageSize = nextPageSize || pageSize;
    const resolvedPage = resolvedPageSize !== pageSize ? 1 : nextPage;
    const nextOffset = (resolvedPage - 1) * resolvedPageSize;

    setPage(resolvedPage);
    setPageSize(resolvedPageSize);
    void load(nextOffset, resolvedPageSize);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.metaRow}>
        <span>
          {t("dataCatalog.preview.summary", {
            count: rows.length,
            total: formatCount(total) as never,
          })}
        </span>
      </div>
      {error ? (
        <Alert message={error} showIcon type="error" />
      ) : (
        <Spin spinning={loading} wrapperClassName={styles.tableSection}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={[styles.rowIndexHead, styles.rowIndex].join(" ")}>#</th>
                  {columns.map((field) => {
                    const head = resolvePreviewColumnHead(field);
                    const primaryLabel = (
                      <span className={styles.columnHeadPrimary}>{head.primary}</span>
                    );

                    return (
                      <th key={field.name}>
                        <div className={styles.columnHead}>
                          {head.tooltip ? (
                            <Tooltip title={head.tooltip}>{primaryLabel}</Tooltip>
                          ) : (
                            primaryLabel
                          )}
                          {head.secondary ? (
                            <span className={styles.columnHeadSecondary}>
                              {head.secondary}
                            </span>
                          ) : null}
                          <span className={styles.columnHeadType}>{head.type}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={offset + rowIndex}>
                    <td className={styles.rowIndex}>{offset + rowIndex + 1}</td>
                    {columns.map((field) => {
                      const value = row[field.name];
                      const isNull = value === null || value === undefined;
                      const text = formatPreviewCell(value);
                      return (
                        <td
                          className={[
                            isNumericType(field.type) ? styles.numericCell : "",
                            isNull ? styles.nullCell : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          key={field.name}
                        >
                          {text.length > 60 ? (
                            <Tooltip title={text}>
                              <span>{text}</span>
                            </Tooltip>
                          ) : (
                            text
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {rows.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={columns.length + 1} className={styles.emptyCell}>
                      {t("dataCatalog.preview.empty")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Spin>
      )}
      {total > 0 ? (
        <TablePaginationBar
          current={page}
          onChange={handlePaginationChange}
          pageSize={pageSize}
          showSizeChanger
          showTotal={(count) => t("common.total", { total: count })}
          total={total}
        />
      ) : null}
    </div>
  );
}
