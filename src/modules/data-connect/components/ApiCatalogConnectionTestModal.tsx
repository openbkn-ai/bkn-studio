/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Checkbox, Input, Modal, Pagination, Select } from "antd";
import BigNumber from "bignumber.js";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import {
  parsePrecisionPreservingJSON,
  precisionPreservingValueText,
} from "@/framework/request/precision-safe-json";
import {
  canTestApiCatalogResource,
  getApiCatalogTestResource,
  listApiCatalogTestResources,
  type ApiCatalogTestResource,
} from "@/modules/data-connect/services/api-catalog-test.service";
import styles from "./ApiCatalogConfigEditor.module.css";

export type ApiCatalogTestScope = "draft" | "saved";
export type ApiCatalogTestKind = "transport" | "local" | "login" | "resource";
export type ApiCatalogBusinessTestInput = { resourceId?: string; paging?: Record<string, unknown> };
export type ApiCatalogTestResult = {
  scope: ApiCatalogTestScope;
  revision: number;
  type: "success" | "error";
  message: string;
  resourceName?: string;
  preview?: string;
};

type Props = {
  saved: boolean;
  catalogId?: string;
  catalogEnabled?: boolean;
  draftLogin?: boolean;
  savedLogin?: boolean;
  defaultScope: ApiCatalogTestScope;
  canTestDraft: boolean;
  canTestSaved: boolean;
  loading: boolean;
  result: ApiCatalogTestResult | null;
  revision: number;
  onRun: (
    scope: ApiCatalogTestScope,
    kind: ApiCatalogTestKind,
    input?: ApiCatalogBusinessTestInput,
  ) => void;
  onClose: () => void;
};

export function ApiCatalogTestResultNotice({
  result,
  revision,
}: {
  result: ApiCatalogTestResult;
  revision: number;
}) {
  const { t } = useTranslation();
  const stale = result.scope === "draft" && result.revision !== revision;
  return (
    <div className={styles.section}>
      <Alert
        role="status"
        showIcon
        type={stale ? "warning" : result.type}
        message={stale ? t("dataConnect.apiCatalog.staleResult") : result.message}
        description={
          <>
            {result.resourceName ? (
              <span>
                {result.resourceName}
                <br />
              </span>
            ) : null}
            {t(
              `dataConnect.apiCatalog.${result.scope === "saved" ? "savedResult" : "draftResult"}`,
            )}
          </>
        }
      />
      {result.preview && !stale ? (
        <details>
          <summary>{t("dataConnect.apiCatalog.resultEntries")}</summary>
          <pre className={styles.preview}>{result.preview}</pre>
        </details>
      ) : null}
    </div>
  );
}

export function ApiCatalogConnectionTestModal(props: Props) {
  const { t } = useTranslation();
  const [scope, setScope] = useState(props.defaultScope);
  const [kind, setKind] = useState<ApiCatalogTestKind>("transport");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [resources, setResources] = useState<ApiCatalogTestResource[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<string>();
  const [detail, setDetail] = useState<ApiCatalogTestResource | null>(null);
  const [loadingResources, setLoadingResources] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [resourceError, setResourceError] = useState<string>();
  const [overridePaging, setOverridePaging] = useState(false);
  const [pagingValues, setPagingValues] = useState({ position: "", limit: "" });
  const catalogId = props.catalogId;
  useEffect(() => {
    if (kind !== "resource" || scope !== "saved" || !catalogId) return;
    const controller = new AbortController();
    setLoadingResources(true);
    setResourceError(undefined);
    const timer = window.setTimeout(() => {
      void listApiCatalogTestResources(catalogId, {
        keyword,
        page,
        pageSize: 20,
        signal: controller.signal,
      })
        .then((result) => {
          if (controller.signal.aborted) return;
          setResources(result.items);
          setTotal(result.total);
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            setResources([]);
            setResourceError(extractRequestErrorMessage(error));
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoadingResources(false);
        });
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [catalogId, kind, scope, keyword, page]);
  useEffect(() => {
    setDetail(null);
    setOverridePaging(false);
    setPagingValues({ position: "", limit: "" });
    if (!selected || scope !== "saved" || kind !== "resource") {
      setLoadingDetail(false);
      return;
    }
    const controller = new AbortController();
    setResourceError(undefined);
    setLoadingDetail(true);
    void getApiCatalogTestResource(selected, { signal: controller.signal })
      .then((resource) => {
        if (controller.signal.aborted) return;
        if (catalogId && resource && canTestApiCatalogResource(resource, catalogId)) {
          setDetail(resource);
          setResourceError(undefined);
        } else setResourceError("dataConnect.apiCatalog.resourceRequired");
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResourceError(extractRequestErrorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingDetail(false);
      });
    return () => controller.abort();
  }, [selected, scope, kind, catalogId]);
  const hasLogin = scope === "saved" ? props.savedLogin : props.draftLogin;
  const rule = detail?.pagingRule;
  const pagingMode = rule?.mode;
  const supportsPaging = pagingMode === "page" || pagingMode === "offset";
  let paging: Record<string, unknown> | undefined;
  let pagingValid = true;
  if (kind === "resource" && overridePaging && supportsPaging) {
    paging = {};
    for (const [field, text] of [
      [pagingMode === "page" ? "page" : "offset", pagingValues.position],
      ["limit", pagingValues.limit],
    ]) {
      if (!text) continue;
      if (!/^(?:0|[1-9]\d*)$/.test(text)) {
        pagingValid = false;
        continue;
      }
      try {
        const number = parsePrecisionPreservingJSON(text);
        const exact = new BigNumber(text);
        if (
          field === "limit" &&
          (!exact.isGreaterThan(0) ||
            (rule?.max_limit !== undefined &&
              exact.isGreaterThan(precisionPreservingValueText(rule.max_limit))))
        )
          pagingValid = false;
        if (
          field === "page" &&
          rule?.page_base !== undefined &&
          exact.isLessThan(precisionPreservingValueText(rule.page_base))
        )
          pagingValid = false;
        paging[field] = number;
      } catch {
        pagingValid = false;
      }
    }
    if (!Object.keys(paging).length) paging = undefined;
  }
  const permitted = scope === "draft" ? props.canTestDraft : props.canTestSaved;
  const businessAllowed =
    kind !== "resource" ||
    (scope === "saved" &&
      !!detail &&
      !!catalogId &&
      canTestApiCatalogResource(detail, catalogId) &&
      pagingValid &&
      !loadingDetail &&
      !resourceError);
  const loginAllowed = kind !== "login" || !!hasLogin;
  const enabled =
    (kind !== "login" && kind !== "resource") ||
    scope !== "saved" ||
    props.catalogEnabled !== false;
  return (
    <Modal
      open
      title={t("dataConnect.apiCatalog.testTitle")}
      onCancel={props.onClose}
      onOk={() =>
        kind === "resource"
          ? props.onRun(scope, kind, { resourceId: detail?.id, paging })
          : props.onRun(scope, kind)
      }
      okText={t("dataConnect.apiCatalog.startTest")}
      cancelText={t("common.close")}
      okButtonProps={{
        disabled: !permitted || !businessAllowed || !loginAllowed || !enabled || props.loading,
        loading: props.loading,
      }}
    >
      <div className={styles.section}>
        <p className={styles.hint}>{t("dataConnect.apiCatalog.testHint")}</p>
        <div className={styles.grid}>
          <label className={styles.field}>
            <span className={styles.label}>{t("dataConnect.apiCatalog.testScope")}</span>
            <Select<ApiCatalogTestScope>
              aria-label={t("dataConnect.apiCatalog.testScope")}
              value={scope}
              onChange={(value) => {
                setScope(value);
                setSelected(undefined);
                setResourceError(undefined);
              }}
              options={[
                {
                  value: "draft",
                  label: t("dataConnect.apiCatalog.draft"),
                  disabled: !props.canTestDraft,
                },
                ...(props.saved
                  ? [
                      {
                        value: "saved" as const,
                        label: t("dataConnect.apiCatalog.saved"),
                        disabled: !props.canTestSaved,
                      },
                    ]
                  : []),
              ]}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{t("dataConnect.apiCatalog.testTarget")}</span>
            <Select<ApiCatalogTestKind>
              aria-label={t("dataConnect.apiCatalog.testTarget")}
              value={kind}
              onChange={(value) => {
                setKind(value);
                setSelected(undefined);
                setResourceError(undefined);
              }}
              options={[
                { value: "transport", label: t("dataConnect.apiCatalog.transport") },
                { value: "local", label: t("dataConnect.apiCatalog.local") },
                {
                  value: "login",
                  label: t("dataConnect.apiCatalog.loginScope"),
                  disabled: !hasLogin,
                },
                {
                  value: "resource",
                  label: t("dataConnect.apiCatalog.resourceScope"),
                  disabled: scope !== "saved" || !props.catalogId || props.catalogEnabled === false,
                },
              ]}
            />
          </label>
        </div>
        <Alert message={t("dataConnect.apiCatalog.backendScopeHint")} showIcon type="info" />
        {scope === "saved" ? (
          <Alert message={t("dataConnect.apiCatalog.savedResult")} showIcon type="warning" />
        ) : null}
        {!enabled ? (
          <Alert message={t("dataConnect.apiCatalog.catalogDisabled")} showIcon type="warning" />
        ) : null}
        {!loginAllowed ? (
          <Alert message={t("dataConnect.apiCatalog.noLoginConfigured")} showIcon type="warning" />
        ) : null}
        {!props.canTestDraft && scope === "draft" ? (
          <Alert message={t("dataConnect.apiCatalog.cannotTestDraft")} showIcon type="warning" />
        ) : null}
        {kind === "resource" && scope === "saved" ? (
          <div className={styles.section}>
            <p className={styles.hint}>{t("dataConnect.apiCatalog.resourceHint")}</p>
            <Input.Search
              aria-label={t("dataConnect.apiCatalog.resourceSearch")}
              placeholder={t("dataConnect.apiCatalog.resourceSearch")}
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(1);
                setSelected(undefined);
              }}
            />
            <label className={styles.field}>
              <span>{t("dataConnect.apiCatalog.resource")}</span>
              <Select
                aria-label={t("dataConnect.apiCatalog.resource")}
                loading={loadingResources || loadingDetail}
                value={selected}
                onChange={(value) => {
                  setSelected(value);
                  setResourceError(undefined);
                }}
                options={resources.map((resource) => ({
                  value: resource.id,
                  label:
                    resource.name +
                    (catalogId && canTestApiCatalogResource(resource, catalogId)
                      ? ""
                      : ` — ${t("dataConnect.apiCatalog.resourceDenied")}`),
                  disabled: !catalogId || !canTestApiCatalogResource(resource, catalogId),
                }))}
                notFoundContent={t("dataConnect.apiCatalog.noResources")}
              />
            </label>
            {total > 20 ? (
              <Pagination
                current={page}
                pageSize={20}
                total={total}
                showSizeChanger={false}
                onChange={(next) => {
                  setPage(next);
                  setSelected(undefined);
                }}
              />
            ) : null}
            {resourceError ? (
              <Alert
                message={
                  resourceError === "dataConnect.apiCatalog.resourceRequired"
                    ? t(resourceError)
                    : resourceError
                }
                type="error"
                showIcon
              />
            ) : null}
            <Alert message={t("dataConnect.apiCatalog.noFilters")} type="info" showIcon />
            {supportsPaging ? (
              <>
                <Checkbox
                  checked={overridePaging}
                  onChange={(event) => setOverridePaging(event.target.checked)}
                >
                  {t("dataConnect.apiCatalog.paging")}
                </Checkbox>
                {overridePaging ? (
                  <div className={styles.grid}>
                    {(["position", "limit"] as const).map((field) => (
                      <label className={styles.field} key={field}>
                        <span>
                          {t(
                            `dataConnect.apiCatalog.${field === "limit" ? "limit" : pagingMode === "page" ? "page" : "offset"}`,
                          )}
                        </span>
                        <Input
                          inputMode="numeric"
                          aria-label={t(
                            `dataConnect.apiCatalog.${field === "limit" ? "limit" : pagingMode === "page" ? "page" : "offset"}`,
                          )}
                          value={pagingValues[field]}
                          placeholder={
                            field === "limit" && rule?.default_limit !== undefined
                              ? precisionPreservingValueText(rule.default_limit)
                              : undefined
                          }
                          onChange={(event) =>
                            setPagingValues((current) => ({
                              ...current,
                              [field]: event.target.value,
                            }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                ) : null}
                <p className={styles.hint}>{t("dataConnect.apiCatalog.pagingHint")}</p>
                {!pagingValid ? (
                  <Alert
                    message={t("dataConnect.apiCatalog.invalidPaging")}
                    type="error"
                    showIcon
                  />
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
        {props.result ? (
          <ApiCatalogTestResultNotice result={props.result} revision={props.revision} />
        ) : null}
      </div>
    </Modal>
  );
}
