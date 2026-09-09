/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ExclamationCircleOutlined } from "@ant-design/icons";
import { Alert, Checkbox, Spin, Tooltip } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  extractRequestErrorMessage,
  isRequestForbidden,
} from "@/framework/request/error-message";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { resourceQueryBlockReason } from "@/modules/data-catalog/lib/resource-query-availability";
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
const PREVIEW_CONTENT_LENGTH = 20;

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

function isTextPreviewType(type: string) {
  const lowered = type.trim().toLowerCase();
  return lowered === "string" || lowered === "text";
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

type PreviewCellDisplay = {
  text: string;
  tooltip?: string;
};

function formatTextPreviewCell(value: unknown): PreviewCellDisplay {
  const text = formatPreviewCell(value);
  if (typeof value !== "string") {
    return { text };
  }
  if (text.length <= PREVIEW_CONTENT_LENGTH) {
    return { text, tooltip: text };
  }
  return {
    text: `${text.slice(0, PREVIEW_CONTENT_LENGTH)}…`,
    tooltip: text,
  };
}

function formatBinaryPreviewCell(
  value: unknown,
  t: (key: string, options?: Record<string, unknown>) => string,
): PreviewCellDisplay {
  if (value === null || value === undefined) {
    return { text: "NULL" };
  }
  if (typeof value === "object" && value !== null) {
    const binaryValue = value as { byte_length?: unknown; data?: unknown; mode?: unknown };
    if (binaryValue.mode === "unavailable") {
      return { text: t("dataCatalog.preview.binaryContentUnavailable") };
    }
    if (binaryValue.mode === "content" && typeof binaryValue.data === "string") {
      const content = binaryValue.data;
      if (content.length <= PREVIEW_CONTENT_LENGTH) {
        return { text: content, tooltip: content };
      }
      return {
        text: `${content.slice(0, PREVIEW_CONTENT_LENGTH)}…`,
        tooltip: content,
      };
    }
    const length = binaryValue.byte_length;
    if (typeof length === "number") {
      return { text: t("dataCatalog.preview.binaryContent", { count: length }) };
    }
  }
  return { text: t("dataCatalog.preview.binaryContentUnavailable") };
}

function formatOtherPreviewCell(
  value: unknown,
  t: (key: string, options?: Record<string, unknown>) => string,
): PreviewCellDisplay {
  if (value !== null && typeof value === "object") {
    const resourceValue = value as { data?: unknown; mode?: unknown };
    if (resourceValue.mode === "unavailable") {
      return { text: t("dataCatalog.preview.fieldContentUnavailable") };
    }
    if ("data" in resourceValue) {
      return { text: formatPreviewCell(resourceValue.data) };
    }
  }
  return { text: formatPreviewCell(value) };
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
  const [forbidden, setForbidden] = useState(false);
  const [ignoreLocalIndex, setIgnoreLocalIndex] = useState(false);
  const [binaryContent, setBinaryContent] = useState(false);
  const requestVersionRef = useRef(0);
  const queryBlockReason = resourceQueryBlockReason(resource);
  const resourceDisabled = queryBlockReason === "disabled";
  const resourceMissing = queryBlockReason === "missing";
  const resourceStale = queryBlockReason === "stale";
  const previewUnavailable = queryBlockReason !== null;
  const hasLocalIndex = resource.category === "table" &&
    resource.localIndexStatus === "available" &&
    Boolean(resource.localIndexName);
  const hasBinaryField = resource.category === "table" &&
    resource.schema.some((field) => field.type.trim().toLowerCase() === "binary");
  const queriesSource = !hasLocalIndex || ignoreLocalIndex;

  const load = useCallback(
    async (nextOffset: number, nextLimit: number) => {
      const requestVersion = ++requestVersionRef.current;
      setLoading(true);
      setError(null);
      setForbidden(false);
      try {
        const data = await previewCatalogResource(resource.id, {
          ...(hasBinaryField && queriesSource ? { binaryMode: binaryContent ? "content" : "metadata" } : {}),
          ...(ignoreLocalIndex ? { ignoreLocalIndex: true } : {}),
          limit: nextLimit,
          offset: nextOffset,
        });
        if (requestVersion !== requestVersionRef.current) {
          return;
        }
        setResult(data);
      } catch (loadError) {
        if (requestVersion !== requestVersionRef.current) {
          return;
        }
        // Reading rows is granted separately from seeing the table's structure. The panel loads on
        // its own, so a bare 403 leaves the user guessing whether the table, the connection or
        // their own access is the problem — name it instead.
        setForbidden(isRequestForbidden(loadError));
        setError(extractRequestErrorMessage(loadError));
        setResult(null);
      } finally {
        if (requestVersion === requestVersionRef.current) {
          setLoading(false);
        }
      }
    },
    [resource.id, ignoreLocalIndex, binaryContent, hasBinaryField, queriesSource],
  );

  useEffect(() => {
    if (!active || disabled || previewUnavailable) {
      requestVersionRef.current += 1;
      return;
    }
    setPage(1);
    setPageSize(DEFAULT_PAGE_SIZE);
    void load(0, DEFAULT_PAGE_SIZE);
    return () => {
      requestVersionRef.current += 1;
    };
  }, [active, disabled, load, previewUnavailable, resource.id]);

  const offset = (page - 1) * pageSize;

  if (disabled) {
    return (
      <div className={styles.gatePanel}>
        <ExclamationCircleOutlined />
        <span>{disabledMessage ?? t("dataCatalog.gate.catalogDisabledShort")}</span>
      </div>
    );
  }

  if (previewUnavailable) {
    const discoveryFailed = resource.lastDiscoverStatus === "error";
    return (
      <Alert
        description={t(
          resourceDisabled
            ? "dataCatalog.preview.resourceDisabledDescription"
            : resourceMissing
              ? "dataCatalog.preview.resourceMissingDescription"
              : resourceStale
                ? "dataCatalog.preview.resourceStaleDescription"
                : discoveryFailed
                  ? "dataCatalog.preview.metadataDiscoveryFailedDescription"
                  : "dataCatalog.preview.metadataUnavailableDescription",
        )}
        message={t(
          resourceDisabled
            ? "dataCatalog.preview.resourceDisabled"
            : resourceMissing
              ? "dataCatalog.preview.resourceMissing"
              : resourceStale
                ? "dataCatalog.preview.resourceStale"
                : discoveryFailed
                  ? "dataCatalog.preview.metadataDiscoveryFailed"
                  : "dataCatalog.preview.metadataUnavailable",
        )}
        showIcon
        type="error"
      />
    );
  }

  const backendTotal = result?.total ?? 0;
  const rows = result?.rows ?? [];
  const fetched = offset + rows.length;
  const totalUnreliable = rows.length === pageSize && backendTotal <= fetched;
  const total = totalUnreliable
    ? Math.max(backendTotal, resource.rowCount, fetched)
    : Math.max(backendTotal, fetched);
  const columns = resource.schema;

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
        <div className={styles.previewControls}>
          {hasLocalIndex ? (
            <Checkbox
              checked={ignoreLocalIndex}
              onChange={(event) => {
                setIgnoreLocalIndex(event.target.checked);
                if (!event.target.checked) {
                  setBinaryContent(false);
                }
              }}
            >
              {t("dataCatalog.preview.queryOriginalSource")}
            </Checkbox>
          ) : null}
          {hasBinaryField ? (
            <Checkbox
              checked={binaryContent}
              disabled={!queriesSource}
              onChange={(event) => setBinaryContent(event.target.checked)}
            >
              {t("dataCatalog.preview.loadBinaryContent")}
            </Checkbox>
          ) : null}
          {result?.querySource ? (
            <span className={styles.dataSource}>
              {t(
                result.querySource === "local_index"
                  ? "dataCatalog.preview.dataSourceIndex"
                  : "dataCatalog.preview.dataSourceOriginal",
              )}
            </span>
          ) : null}
        </div>
      </div>
      {forbidden ? (
        <Alert
          description={t("dataCatalog.preview.noQueryPermissionDescription")}
          message={t("dataCatalog.preview.noQueryPermission")}
          showIcon
          type="info"
        />
      ) : error ? (
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
                      const binaryDisplay = field.type.trim().toLowerCase() === "binary"
                        ? formatBinaryPreviewCell(value, t)
                        : undefined;
                      const otherDisplay = field.type.trim().toLowerCase() === "other"
                        ? formatOtherPreviewCell(value, t)
                        : undefined;
                      const textDisplay = isTextPreviewType(field.type)
                        ? formatTextPreviewCell(value)
                        : undefined;
                      const display = binaryDisplay ?? otherDisplay ?? textDisplay;
                      const text = display?.text ?? formatPreviewCell(value);
                      const tooltip = display?.tooltip ?? text;
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
                          <Tooltip title={tooltip}>
                            <span>{text}</span>
                          </Tooltip>
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
