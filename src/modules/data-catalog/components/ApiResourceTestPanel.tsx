/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Button, Checkbox, InputNumber, Space, Table } from "antd";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { extractRequestErrorDetails, isRequestConflict } from "@/framework/request/error-message";
import { transformPrecisionSafeJSONRequest } from "@/framework/request/precision-safe-json";
import { apiResourcePagingRule, apiResourceSupportsTotal } from "../lib/api-resource";
import { getApiResource, queryApiResource } from "../services/api-resource.service";
import type { ApiResource, ApiResourceQuery, ApiResourceResult } from "../types/api-resource";
import styles from "./ApiResourceEditor.module.css";

export function ApiResourceTestPanel({
  resource,
  canQuery,
  revision,
  hasUnsavedDefinition,
  onConflict,
}: {
  resource: ApiResource;
  canQuery: boolean;
  revision: number;
  hasUnsavedDefinition: boolean;
  onConflict: () => void;
}) {
  const { t } = useTranslation();
  const mockMode = import.meta.env.VITE_USE_MOCK !== "false";
  const [pagingEnabled, setPagingEnabled] = useState(false);
  const [offset, setOffset] = useState<number | null>(null);
  const [limit, setLimit] = useState<number | null>(null);
  const [needTotal, setNeedTotal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<{
    data: ApiResourceResult;
    revision: number;
    query: string;
    version: string;
  }>();
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const hasPaging = apiResourcePagingRule(resource.api_definition) !== undefined;
  const supportsTotal = apiResourceSupportsTotal(resource.api_definition);
  const usesExplicitPaging = hasPaging && pagingEnabled;
  const query: ApiResourceQuery = {
    ...(usesExplicitPaging
      ? {
          paging: {
            mode: "single",
            ...(offset !== null ? { offset } : {}),
            ...(limit !== null ? { limit } : {}),
          },
        }
      : {}),
    ...(supportsTotal && needTotal ? { need_total: true } : {}),
  };
  const queryIdentity = transformPrecisionSafeJSONRequest(query);
  const current =
    !hasUnsavedDefinition &&
    result?.revision === revision &&
    result.query === queryIdentity &&
    result.version === String(resource.update_time);
  let resultMessage = "dataCatalog.apiResource.staleTest";
  if (current)
    resultMessage = mockMode
      ? "dataCatalog.apiResource.mockTestSuccess"
      : "dataCatalog.apiResource.testSuccess";
  const run = async () => {
    if (!canQuery || busy) return;
    setError(undefined);
    setResult(undefined);
    if (
      usesExplicitPaging &&
      [offset, limit].some((value) => value !== null && (!Number.isSafeInteger(value) || value < 0))
    ) {
      setError(t("dataCatalog.apiResource.errors.paging"));
      return;
    }
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    try {
      const latest = await getApiResource(resource.id, request.signal);
      request.signal.throwIfAborted();
      if (String(latest.update_time) !== String(resource.update_time)) {
        onConflict();
        return;
      }
      if (
        !latest.enabled ||
        latest.status !== "active" ||
        !(latest.operations.includes("*") || latest.operations.includes("query_data"))
      ) {
        setError(t("dataCatalog.apiResource.errors.queryUnavailable"));
        return;
      }
      const data = await queryApiResource(resource.id, query, request.signal);
      const after = await getApiResource(resource.id, request.signal);
      if (String(after.update_time) !== String(latest.update_time)) {
        if (!request.signal.aborted) onConflict();
        return;
      }
      if (!request.signal.aborted)
        setResult({ data, revision, query: queryIdentity, version: String(latest.update_time) });
    } catch (failure) {
      if (request.signal.aborted) return;
      const details = extractRequestErrorDetails(failure);
      if (isRequestConflict(failure) && details.code === "VegaBackend.Resource.UpdateConflict") {
        onConflict();
      }
      const stage =
        typeof details.metadata?.stage === "string" ? details.metadata.stage : undefined;
      setError([details.code, details.description, stage].filter(Boolean).join(" · "));
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  };
  const cell = (value: unknown) =>
    value === undefined
      ? "—"
      : typeof value === "string"
        ? value
        : transformPrecisionSafeJSONRequest(value);
  return (
    <div className={styles.stack}>
      <Alert
        type="info"
        showIcon
        message={t(
          mockMode
            ? "dataCatalog.apiResource.mockTestHint"
            : "dataCatalog.apiResource.savedTestHint",
        )}
      />
      {hasPaging ? (
        <Checkbox
          checked={pagingEnabled}
          disabled={busy}
          onChange={(event) => setPagingEnabled(event.target.checked)}
        >
          {t("dataCatalog.apiResource.testPaging")}
        </Checkbox>
      ) : null}
      {usesExplicitPaging ? (
        <div className={styles.grid}>
          <label className={styles.field}>
            {t("dataCatalog.apiResource.offset")}
            <InputNumber
              aria-label={t("dataCatalog.apiResource.offset")}
              disabled={busy}
              value={offset}
              onChange={setOffset}
            />
          </label>
          <label className={styles.field}>
            {t("dataCatalog.apiResource.limit")}
            <InputNumber
              aria-label={t("dataCatalog.apiResource.limit")}
              disabled={busy}
              value={limit}
              onChange={setLimit}
            />
          </label>
        </div>
      ) : null}
      {supportsTotal ? (
        <Checkbox
          checked={needTotal}
          disabled={busy}
          onChange={(event) => setNeedTotal(event.target.checked)}
        >
          {t("dataCatalog.apiResource.needTotal")}
        </Checkbox>
      ) : null}
      <Space>
        <Button type="primary" loading={busy} disabled={!canQuery} onClick={() => void run()}>
          {t("dataCatalog.apiResource.run")}
        </Button>
        {busy ? (
          <Button
            onClick={() => {
              controller.current?.abort();
              setBusy(false);
            }}
          >
            {t("common.cancel")}
          </Button>
        ) : null}
      </Space>
      {error ? (
        <div role="alert">
          <Alert type="error" showIcon message={error} />
        </div>
      ) : null}
      {result ? (
        <div className={styles.stack} aria-live="polite">
          <Alert
            type={current ? "success" : "warning"}
            showIcon
            message={t(resultMessage)}
            description={t("dataCatalog.apiResource.testVersion", { version: result.version })}
          />
          <Table
            pagination={false}
            scroll={{ x: true }}
            size="small"
            rowKey="index"
            dataSource={result.data.entries.map((entry, index) => ({ index, entry }))}
            columns={resource.schema_definition.map((field) => ({
              title: field.display_name || field.name,
              key: field.name,
              render: (_: unknown, row: { index: number; entry: Record<string, unknown> }) => (
                <span>{cell(row.entry[field.name])}</span>
              ),
            }))}
            locale={{ emptyText: t("dataCatalog.apiResource.emptyResult") }}
          />
          <p>
            {t("dataCatalog.apiResource.total")}:{" "}
            {result.data.total_count === undefined
              ? t("dataCatalog.apiResource.unknown")
              : String(result.data.total_count)}
          </p>
          {result.data.paging ? (
            <pre className={styles.preview}>
              {transformPrecisionSafeJSONRequest(result.data.paging)}
            </pre>
          ) : null}
          {result.data.warnings?.length ? (
            <Alert type="warning" message={t("dataCatalog.apiResource.warnings")} />
          ) : null}
          <p>{t("dataCatalog.apiResource.noTraversal")}</p>
        </div>
      ) : null}
    </div>
  );
}
