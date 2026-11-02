/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CopyOutlined } from "@ant-design/icons";
import { Alert, Button, Checkbox, Modal, Spin, Tooltip } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { writeTextToClipboard } from "@/framework/compat/clipboard";
import { useAppServices } from "@/framework/context/use-app-services";
import {
  extractRequestErrorDetails,
  isRequestForbidden,
  type RequestErrorDetails,
} from "@/framework/request/error-message";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { FieldIdentity } from "@/modules/data-catalog/components/FieldIdentity";
import { FilterTreeEditor } from "@/modules/data-catalog/components/FilterTreeEditor";
import {
  emptyFilterGroup,
  filterToBackend,
  filterValidationError,
  type FilterGroup,
  type FilterQueryPath,
} from "@/modules/data-catalog/lib/filter-tree";
import {
  resourceCountAsBigInt,
  resourceCountForPagination,
} from "@/modules/data-catalog/lib/resource-count";
import { resourceQueryBlockReason } from "@/modules/data-catalog/lib/resource-query-availability";
import { fixedFilterSourceBlockReason } from "@/modules/data-catalog/lib/view-query-source";
import { previewCatalogResource } from "@/modules/data-catalog/services/resource.service";
import type {
  CatalogResource,
  ResourcePreviewResult,
} from "@/modules/data-catalog/types/data-catalog";
import { hasCatalogResourceOperation } from "@/modules/data-catalog/utils/resource-operations";

import styles from "./ResourcePreviewPanel.module.css";

type ResourcePreviewPanelProps = {
  active: boolean;
  disabled?: boolean;
  disabledMessage?: string;
  resource: CatalogResource;
};

const DEFAULT_PAGE_SIZE = 10;
const INDEX_PREVIEW_PAGE_LIMIT = 10_000;
const PREVIEW_CONTENT_LENGTH = 20;
const EMPTY_APPLIED_FILTER = emptyFilterGroup();

const PROJECTION_ERROR_MESSAGES = new Map([
  ["VegaBackend.Query.InvalidParameter.OutputField", "dataCatalog.preview.invalidOutputField"],
  ["VegaBackend.Query.UnsupportedOutputField", "dataCatalog.preview.unsupportedOutputField"],
  ["VegaBackend.Query.NoQueryableFields", "dataCatalog.preview.noQueryableFields"],
]);

function isNumericType(type: string) {
  const lowered = type.toLowerCase();
  return (
    lowered.startsWith("int") ||
    lowered.startsWith("bigint") ||
    lowered === "large_integer" ||
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
  fullText?: string;
};

function formatTextPreviewCell(value: unknown): PreviewCellDisplay {
  const text = formatPreviewCell(value);
  if (typeof value !== "string") {
    return { text };
  }
  return formatExpandablePreviewCell(text);
}

function formatExpandablePreviewCell(value: unknown): PreviewCellDisplay {
  const text = formatPreviewCell(value);
  if (text.length <= PREVIEW_CONTENT_LENGTH) {
    return { text, tooltip: text };
  }
  return {
    text: `${text.slice(0, PREVIEW_CONTENT_LENGTH)}…`,
    tooltip: text,
    fullText: text,
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
    if (binaryValue.mode === "content" && typeof binaryValue.data === "string") {
      const content = binaryValue.data;
      if (content.length <= PREVIEW_CONTENT_LENGTH) {
        return { text: content, tooltip: content };
      }
      return {
        text: `${content.slice(0, PREVIEW_CONTENT_LENGTH)}…`,
        tooltip: content,
        fullText: content,
      };
    }
    const length = binaryValue.byte_length;
    if (typeof length === "number") {
      return { text: t("dataCatalog.preview.binaryContent", { count: length }) };
    }
  }
  return { text: t("dataCatalog.preview.binaryContentUnavailable") };
}

export function ResourcePreviewPanel(props: ResourcePreviewPanelProps) {
  // Query choices, results and in-flight requests belong to one resource.
  return <ResourcePreviewContent key={props.resource.id} {...props} />;
}

function ResourcePreviewContent({
  active,
  disabled = false,
  disabledMessage,
  resource,
}: ResourcePreviewPanelProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ResourcePreviewResult | null>(null);
  const [fullValue, setFullValue] = useState<{ field: string; text: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{
    message: string;
    description?: string;
    invalidResponse?: boolean;
  } | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [sourceReadDetails, setSourceReadDetails] = useState<RequestErrorDetails | null>(null);
  const [sourceSelected, setSourceSelected] = useState(false);
  const [viewHasLocalIndex, setViewHasLocalIndex] = useState(false);
  const [binaryContent, setBinaryContent] = useState(false);
  const [filterDraft, setFilterDraft] = useState<FilterGroup>(emptyFilterGroup);
  const [appliedFilter, setAppliedFilter] = useState<FilterGroup>(emptyFilterGroup);
  const [filterRetryVersion, setFilterRetryVersion] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const requestVersionRef = useRef(0);
  const queryBlockReason = resourceQueryBlockReason(resource);
  const resourceDisabled = queryBlockReason === "disabled";
  const resourceMissing = queryBlockReason === "missing";
  const resourceStale = queryBlockReason === "stale";
  const previewUnavailable = queryBlockReason !== null;
  const canQueryData = hasCatalogResourceOperation(resource, "query_data");
  const hasLocalIndex =
    resource.category === "table" &&
    resource.localIndexStatus === "available" &&
    Boolean(resource.localIndexName);
  const isDerivedView = resource.category === "logical_view" && resource.logicType === "derived";
  const sourceId = resource.logicDefinition?.sourceResourceId;
  const invalidViewMetadata =
    resource.category === "logical_view" &&
    ((resource.logicType !== "derived" && resource.logicType !== "composite") ||
      (isDerivedView &&
        (typeof sourceId !== "string" ||
          !sourceId.trim() ||
          (resource.sourceMetadata?.sourceCategory !== "table" &&
            resource.sourceMetadata?.sourceCategory !== "index"))));
  const isTableView = isDerivedView && resource.sourceMetadata?.sourceCategory === "table";
  const sourceBlockReason = isTableView
    ? fixedFilterSourceBlockReason(resource.logicDefinition?.filterCondition)
    : null;
  const canSwitchSource =
    hasLocalIndex ||
    (isTableView &&
      (viewHasLocalIndex || sourceSelected || Boolean(error || forbidden || sourceReadDetails)));
  const sourceSelectionAllowed =
    !invalidViewMetadata && canSwitchSource && sourceBlockReason === null;
  const sourceSwitchDisabled = !sourceSelectionAllowed || Boolean(error?.invalidResponse);
  const ignoreLocalIndex = sourceSelected && sourceSelectionAllowed;
  let sourceSwitchHintKey: string | undefined;
  if (sourceSwitchDisabled) {
    if (invalidViewMetadata) {
      sourceSwitchHintKey = "dataCatalog.preview.invalidViewMetadata";
    } else if (sourceBlockReason) {
      sourceSwitchHintKey =
        sourceBlockReason === "indexRequired"
          ? "dataCatalog.preview.fixedFilterRequiresIndex"
          : "dataCatalog.preview.fixedFilterSourceUnknown";
    } else if (isTableView && (error || forbidden || sourceReadDetails)) {
      sourceSwitchHintKey = "dataCatalog.preview.queryOriginalFailed";
    } else if (isTableView && (loading || !result)) {
      sourceSwitchHintKey = "dataCatalog.preview.queryOriginalLoading";
    } else if (resource.category === "table" || isTableView) {
      sourceSwitchHintKey = "dataCatalog.preview.queryOriginalAlreadyActive";
    } else {
      sourceSwitchHintKey = "dataCatalog.preview.queryOriginalUnavailable";
    }
  }
  const hasBinaryField =
    resource.category === "table" &&
    resource.schema.some((field) => field.type.trim().toLowerCase() === "binary");
  const queriesSource = !hasLocalIndex || ignoreLocalIndex;
  const queryPath: FilterQueryPath =
    resource.category === "dataset" ||
    resource.category === "index" ||
    (resource.category === "table" && !queriesSource) ||
    (resource.category === "logical_view" &&
      (resource.sourceMetadata?.sourceCategory === "index" ||
        (!ignoreLocalIndex && (viewHasLocalIndex || result?.querySource === "local_index"))))
      ? "local_index"
      : "source";
  const activeFilter =
    filterValidationError(appliedFilter, resource.schema, queryPath) === null
      ? appliedFilter
      : EMPTY_APPLIED_FILTER;
  // An unfiltered request does not depend on the query path learned from its response.
  const filterQueryPath = activeFilter.children.length ? queryPath : "source";

  const load = useCallback(
    async (nextOffset: number, nextLimit: number) => {
      if (invalidViewMetadata) return;
      const requestVersion = ++requestVersionRef.current;
      setLoading(true);
      setError(null);
      setForbidden(false);
      setSourceReadDetails(null);
      try {
        const data = await previewCatalogResource(resource.id, {
          ...(hasBinaryField && queriesSource
            ? { binaryMode: binaryContent ? "content" : "metadata" }
            : {}),
          ...(ignoreLocalIndex ? { ignoreLocalIndex: true } : {}),
          ...(activeFilter.children.length
            ? { filterCondition: filterToBackend(activeFilter, resource.schema, filterQueryPath) }
            : {}),
          limit: nextLimit,
          offset: nextOffset,
        });
        if (requestVersion !== requestVersionRef.current) {
          return;
        }
        if (isDerivedView && data.querySource !== "local_index" && data.querySource !== "source") {
          setError({ message: t("dataCatalog.preview.invalidQuerySource"), invalidResponse: true });
          setResult(null);
          return;
        }
        setResult(data);
        if (isTableView && !ignoreLocalIndex) {
          // A forced source response must not remove the option to switch back to the index.
          setViewHasLocalIndex(data.querySource === "local_index");
        }
      } catch (loadError) {
        if (requestVersion !== requestVersionRef.current) {
          return;
        }
        // Reading rows is granted separately from seeing the table's structure. The panel loads on
        // its own, so a bare 403 leaves the user guessing whether the table, the connection or
        // their own access is the problem — name it instead.
        const details = extractRequestErrorDetails(loadError);
        const sourceDenied = details.code === "VegaBackend.Resource.SourceReadForbidden";
        setSourceReadDetails(sourceDenied ? details : null);
        setForbidden(!sourceDenied && isRequestForbidden(loadError));
        if (details.code === "VegaBackend.Resource.QueryValueExceedsKeywordLimit") {
          const field = details.metadata?.field;
          const limit = details.metadata?.limit;
          const validParameters =
            typeof field === "string" &&
            field.trim().length > 0 &&
            typeof limit === "number" &&
            Number.isSafeInteger(limit) &&
            limit > 0;
          setError({
            message: validParameters
              ? t("dataCatalog.preview.keywordLimitExceeded", { field, limit })
              : t("dataCatalog.preview.keywordLimitExceededGeneric"),
            description: t(
              hasLocalIndex && !ignoreLocalIndex
                ? "dataCatalog.preview.keywordLimitSourceHint"
                : "dataCatalog.preview.keywordLimitShortenHint",
            ),
          });
          setResult(null);
          return;
        }
        const projectionMessage = PROJECTION_ERROR_MESSAGES.get(details.code ?? "");
        const explanation = projectionMessage ? t(projectionMessage) : details.description;
        setError({
          message: explanation,
          ...(projectionMessage &&
          details.descriptionSource === "response" &&
          details.description !== explanation
            ? { description: details.description }
            : {}),
        });
        setResult(null);
      } finally {
        if (requestVersion === requestVersionRef.current) {
          setLoading(false);
        }
      }
    },
    [
      resource.id,
      resource.schema,
      ignoreLocalIndex,
      binaryContent,
      hasBinaryField,
      hasLocalIndex,
      invalidViewMetadata,
      isDerivedView,
      isTableView,
      queriesSource,
      filterQueryPath,
      activeFilter,
      t,
    ],
  );

  useEffect(() => {
    if (active) return;
    setFilterDraft(emptyFilterGroup());
    setAppliedFilter(emptyFilterGroup());
    setFilterOpen(false);
  }, [active]);

  useEffect(() => {
    // Recheck existing feedback without validating an untouched draft or applying it automatically.
    setFilterError((current) => {
      if (current === null) return null;
      const validation = filterValidationError(filterDraft, resource.schema, queryPath);
      return validation ? t(`dataCatalog.filter.errors.${validation}`) : null;
    });
  }, [filterDraft, queryPath, resource.schema, t]);

  useEffect(() => {
    if (!appliedFilter.children.length || activeFilter.children.length) return;
    setAppliedFilter(emptyFilterGroup());
    setFilterError(t("dataCatalog.preview.filterUnavailableForSource"));
    setFilterOpen(true);
  }, [activeFilter.children.length, appliedFilter.children.length, t]);

  useEffect(() => {
    if (!active || disabled || previewUnavailable || !canQueryData || invalidViewMetadata) {
      requestVersionRef.current += 1;
      return;
    }
    setPage(1);
    setPageSize(DEFAULT_PAGE_SIZE);
    void load(0, DEFAULT_PAGE_SIZE);
    return () => {
      requestVersionRef.current += 1;
    };
  }, [
    active,
    canQueryData,
    disabled,
    filterRetryVersion,
    invalidViewMetadata,
    load,
    previewUnavailable,
    resource.id,
  ]);

  const offset = (page - 1) * pageSize;

  if (disabled) {
    return (
      <Alert
        message={disabledMessage ?? t("dataCatalog.gate.catalogDisabledShort")}
        showIcon
        type="warning"
      />
    );
  }

  if (previewUnavailable) {
    const discoveryFailed =
      resource.category !== "dataset" && resource.lastDiscoverStatus === "error";
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

  if (!canQueryData) {
    return (
      <Alert
        description={t("dataCatalog.preview.noQueryPermissionDescription")}
        message={t("dataCatalog.preview.noQueryPermission")}
        showIcon
        type="warning"
      />
    );
  }

  const backendTotal = result?.total ?? 0;
  const rows = result?.rows ?? [];
  const fetched = offset + rows.length;
  const totalUnreliable =
    !appliedFilter.children.length &&
    !resource.logicDefinition?.filterCondition &&
    rows.length === pageSize &&
    resourceCountAsBigInt(backendTotal) < BigInt(fetched);
  const total = totalUnreliable
    ? resourceCountForPagination(backendTotal, resource.rowCount, fetched)
    : resourceCountForPagination(backendTotal, fetched);
  const indexWindowLimited =
    result?.querySource === "local_index" && total > INDEX_PREVIEW_PAGE_LIMIT;
  const paginationTotal = indexWindowLimited ? INDEX_PREVIEW_PAGE_LIMIT : total;
  const columns = resource.schema;

  const handlePaginationChange = (nextPage: number, nextPageSize: number) => {
    const resolvedPageSize = nextPageSize || pageSize;
    const resolvedPage = resolvedPageSize !== pageSize ? 1 : nextPage;
    const nextOffset = (resolvedPage - 1) * resolvedPageSize;

    setPage(resolvedPage);
    setPageSize(resolvedPageSize);
    void load(nextOffset, resolvedPageSize);
  };

  const copyFullValue = () => {
    if (!fullValue) return;
    void writeTextToClipboard(fullValue.text)
      .then(() => message.success(t("dataCatalog.preview.copyFullValueSuccess")))
      .catch(() => message.error(t("dataCatalog.preview.copyFullValueFailed")));
  };

  return (
    <div className={styles.panel}>
      <div className={styles.metaRow}>
        <div className={styles.previewControls}>
          <Button disabled={invalidViewMetadata} onClick={() => setFilterOpen((open) => !open)}>
            {t("dataCatalog.preview.filter")}
            {activeFilter.children.length ? ` (${activeFilter.children.length})` : ""}
          </Button>
          <Tooltip
            title={sourceSwitchHintKey ? t(sourceSwitchHintKey) : undefined}
            trigger={["hover", "focus"]}
          >
            <span tabIndex={sourceSwitchDisabled ? 0 : undefined}>
              <Checkbox
                checked={ignoreLocalIndex}
                disabled={sourceSwitchDisabled}
                onChange={(event) => {
                  setSourceSelected(event.target.checked);
                  if (!event.target.checked) {
                    setBinaryContent(false);
                  }
                }}
              >
                {t("dataCatalog.preview.queryOriginalSource")}
              </Checkbox>
            </span>
          </Tooltip>
          {hasBinaryField ? (
            <Checkbox
              checked={binaryContent}
              disabled={!queriesSource}
              onChange={(event) => setBinaryContent(event.target.checked)}
            >
              {t("dataCatalog.preview.loadBinaryContent")}
            </Checkbox>
          ) : null}
          {!invalidViewMetadata && result?.querySource ? (
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
      {filterOpen ? (
        <div className={styles.filterPanel}>
          <FilterTreeEditor
            fields={resource.schema}
            queryPath={queryPath}
            onChange={(next) => {
              setFilterDraft(next);
              setFilterError(null);
            }}
            value={filterDraft}
          />
          {filterError ? <Alert message={filterError} showIcon type="error" /> : null}
          <div className={styles.filterActions}>
            <Button
              type="primary"
              onClick={() => {
                const validation = filterValidationError(filterDraft, resource.schema, queryPath);
                if (validation) {
                  setFilterError(t(`dataCatalog.filter.errors.${validation}`));
                  return;
                }
                setFilterError(null);
                if (filterDraft === appliedFilter && error) {
                  setFilterRetryVersion((version) => version + 1);
                } else {
                  setAppliedFilter(filterDraft);
                }
              }}
            >
              {t("dataCatalog.preview.applyFilter")}
            </Button>
            <Button
              onClick={() => {
                setFilterDraft(emptyFilterGroup());
                setAppliedFilter(emptyFilterGroup());
                setFilterError(null);
              }}
            >
              {t("dataCatalog.preview.clearFilter")}
            </Button>
          </div>
        </div>
      ) : null}
      {invalidViewMetadata ? (
        <Alert message={t("dataCatalog.preview.invalidViewMetadata")} showIcon type="error" />
      ) : sourceReadDetails ? (
        <Alert
          description={
            <>
              <div>
                {t(
                  resource.category === "table"
                    ? "dataCatalog.preview.sourceReadForbiddenDescription"
                    : "dataCatalog.preview.sourceReadForbiddenGenericDescription",
                )}
              </div>
              {sourceReadDetails.descriptionSource === "response" ? (
                <div>{sourceReadDetails.description}</div>
              ) : null}
            </>
          }
          message={
            resource.category === "table"
              ? t("dataCatalog.preview.sourceReadForbidden", {
                  source: resource.sourceIdentifier || resource.name,
                })
              : t("dataCatalog.preview.sourceReadForbiddenGeneric")
          }
          showIcon
          type="warning"
        />
      ) : forbidden ? (
        <Alert
          description={t("dataCatalog.preview.noQueryPermissionDescription")}
          message={t("dataCatalog.preview.noQueryPermission")}
          showIcon
          type="warning"
        />
      ) : error ? (
        <Alert description={error.description} message={error.message} showIcon type="error" />
      ) : (
        <Spin spinning={loading} wrapperClassName={styles.tableSection}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={[styles.rowIndexHead, styles.rowIndex].join(" ")}>#</th>
                  {columns.map((field) => (
                    <th key={field.name}>
                      <FieldIdentity field={field} name={field.name} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={offset + rowIndex}>
                    <td className={styles.rowIndex}>{offset + rowIndex + 1}</td>
                    {columns.map((field) => {
                      const value = row[field.name];
                      const isNull = Object.hasOwn(row, field.name) && value === null;
                      const unavailable =
                        (field.type.trim().toLowerCase() === "binary" ||
                          (field.type.trim().toLowerCase() === "other" &&
                            result?.querySource === "local_index")) &&
                        value !== null &&
                        typeof value === "object" &&
                        "mode" in value &&
                        value.mode === "unavailable";
                      const stateDisplay: PreviewCellDisplay | undefined =
                        !Object.hasOwn(row, field.name) || value === undefined
                          ? {
                              text: t("dataCatalog.preview.fieldNotReturned"),
                              tooltip: t("dataCatalog.preview.fieldNotReturnedHint"),
                            }
                          : unavailable
                            ? {
                                text: t(
                                  field.type.trim().toLowerCase() === "binary"
                                    ? "dataCatalog.preview.binaryContentUnavailable"
                                    : "dataCatalog.preview.fieldContentUnavailable",
                                ),
                                tooltip: t(
                                  "reason" in value && value.reason === "not_requested"
                                    ? "dataCatalog.preview.contentNotRequested"
                                    : field.type.trim().toLowerCase() === "binary"
                                      ? "dataCatalog.preview.binaryContentUnavailableHint"
                                      : "dataCatalog.preview.fieldContentUnavailableHint",
                                ),
                              }
                            : undefined;
                      const binaryDisplay =
                        field.type.trim().toLowerCase() === "binary"
                          ? formatBinaryPreviewCell(value, t)
                          : undefined;
                      const otherDisplay =
                        field.type.trim().toLowerCase() === "other"
                          ? formatExpandablePreviewCell(value)
                          : undefined;
                      const textDisplay = isTextPreviewType(field.type)
                        ? formatTextPreviewCell(value)
                        : undefined;
                      const display = stateDisplay ?? binaryDisplay ?? otherDisplay ?? textDisplay;
                      const text = display?.text ?? formatPreviewCell(value);
                      const tooltip = display?.tooltip ?? text;
                      const fullText = display?.fullText;
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
                          <Tooltip
                            classNames={fullText ? { root: styles.previewValueTooltip } : undefined}
                            title={tooltip}
                          >
                            {fullText ? (
                              <button
                                className={styles.previewValueButton}
                                onClick={() => setFullValue({ field: field.name, text: fullText })}
                                type="button"
                              >
                                {text}
                              </button>
                            ) : (
                              <span>{text}</span>
                            )}
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
      {indexWindowLimited ? (
        <Alert
          message={t("dataCatalog.preview.indexPageLimit", {
            limit: INDEX_PREVIEW_PAGE_LIMIT,
            total,
          })}
          showIcon
          type="info"
        />
      ) : null}
      {paginationTotal > 0 ? (
        <TablePaginationBar
          current={page}
          onChange={handlePaginationChange}
          pageSize={pageSize}
          showSizeChanger
          showTotal={(count) => t("common.total", { total: count })}
          total={paginationTotal}
        />
      ) : null}
      <Modal
        footer={
          <Button
            aria-label={t("dataCatalog.preview.copyFullValue")}
            icon={<CopyOutlined />}
            onClick={copyFullValue}
          >
            {t("dataCatalog.preview.copyFullValue")}
          </Button>
        }
        onCancel={() => setFullValue(undefined)}
        open={Boolean(fullValue)}
        title={
          fullValue ? t("dataCatalog.preview.fullValue", { field: fullValue.field }) : undefined
        }
        width={720}
      >
        <pre className={styles.fullPreviewValue}>{fullValue?.text}</pre>
      </Modal>
    </div>
  );
}
