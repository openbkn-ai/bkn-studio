/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { transformNumberLiteralJSONRequest } from "@/framework/request/precision-safe-json";
import BigNumber from "bignumber.js";
import { InputNumber, Switch } from "antd";
import { Fragment, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { FilterTreeEditor } from "./FilterTreeEditor";
import {
  apiFilterOperationsForField,
  emptyFilterGroup,
  filterToBackend,
  filterValidationError,
} from "../lib/filter-tree";
import { apiResourcePagingRule } from "../lib/api-resource";
import type { ApiResourceInput, ApiResourceQuery } from "../types/api-resource";
import type { ResourceSchemaField } from "../types/data-catalog";
import viewStyles from "../scenes/ViewEditorScene.module.css";
import styles from "./ApiResourceEditor.module.css";

function InvocationGroup({
  label,
  checked,
  disabled,
  unavailableReason,
  onChange,
  children,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  unavailableReason?: string;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  const labelId = useId();
  const reasonId = useId();
  return (
    <div
      className={`${styles.stack} ${viewStyles.configGroup}`}
      role="group"
      aria-labelledby={labelId}
    >
      <div className={`${styles.field} ${styles.inlineToggle}`}>
        <span id={labelId}>{label}</span>
        <Switch
          aria-labelledby={labelId}
          aria-describedby={unavailableReason ? reasonId : undefined}
          disabled={disabled}
          checked={checked}
          onChange={onChange}
        />
      </div>
      {unavailableReason ? (
        <p id={reasonId} className={styles.cardHint}>
          {unavailableReason}
        </p>
      ) : null}
      {children}
    </div>
  );
}

/** Transient inputs for saving and validating an API Resource. */
export function ApiResourceInvocationEditor({
  resource,
  value,
  onChange,
  onValidityChange,
  disabled,
}: {
  resource: ApiResourceInput;
  value: ApiResourceQuery;
  onChange: (next: ApiResourceQuery) => void;
  onValidityChange: (valid: boolean) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState(emptyFilterGroup);
  const [filterEnabled, setFilterEnabled] = useState(false);
  const [showError, setShowError] = useState(false);
  const pagingId = useId();
  const pagingErrorId = `${pagingId}-error`;
  const [pagingDraft, setPagingDraft] = useState<Record<"offset" | "limit", string | null>>(() => ({
    offset: value.paging?.offset === undefined ? null : String(value.paging.offset),
    limit: value.paging?.limit === undefined ? null : String(value.paging.limit),
  }));
  const validPageValue = (raw: string | null) => {
    if (raw === null) return true;
    const count = new BigNumber(raw);
    return count.isInteger() && !count.isNegative() && count.lte(Number.MAX_SAFE_INTEGER);
  };
  const supportsPaging = apiResourcePagingRule(resource.api_definition) !== undefined;
  const page = supportsPaging ? value.paging : undefined;
  const discardPaging = !supportsPaging && value.paging !== undefined;
  const pagingInvalid =
    page !== undefined && Object.values(pagingDraft).some((raw) => !validPageValue(raw));
  const fields = useMemo<ResourceSchemaField[]>(
    () =>
      resource.schema_definition
        .filter((field) => field.name.trim())
        .map((field) => ({
          name: field.name,
          type: field.type,
          displayName: field.display_name,
          filterable: field.filterable,
        })),
    [resource.schema_definition],
  );
  const supportsFilter = fields.some((field) => apiFilterOperationsForField(field).length > 0);
  const usesFilter = supportsFilter && filterEnabled;
  const discardFilter = !supportsFilter && value.filter_condition !== undefined;
  const currentError = usesFilter ? filterValidationError(filter, fields) : null;
  useEffect(
    () => onValidityChange(!currentError && !pagingInvalid && !discardPaging && !discardFilter),
    [currentError, pagingInvalid, discardPaging, discardFilter, onValidityChange],
  );
  useEffect(() => {
    if (!supportsFilter && (filterEnabled || filter.children.length)) {
      setFilterEnabled(false);
      setFilter(emptyFilterGroup());
    }
    if (currentError && !discardPaging) return;
    const next = { ...value };
    if (discardPaging) delete next.paging;
    if (!currentError) {
      const condition = usesFilter ? filterToBackend(filter, fields) : null;
      if (condition) next.filter_condition = condition;
      else delete next.filter_condition;
    }
    if (transformNumberLiteralJSONRequest(next) !== transformNumberLiteralJSONRequest(value))
      onChange(next);
  }, [
    currentError,
    discardPaging,
    supportsFilter,
    usesFilter,
    filterEnabled,
    filter,
    fields,
    value,
    onChange,
  ]);
  const updateFilter = (next: typeof filter, enabled: boolean) => {
    setFilter(next);
    setFilterEnabled(enabled);
    const invalid = enabled ? filterValidationError(next, fields) : null;

    if (!invalid) {
      const condition = enabled ? filterToBackend(next, fields) : null;
      const result = { ...value };
      if (condition) result.filter_condition = condition;
      else delete result.filter_condition;
      onChange(result);
    }
  };
  return (
    <div className={styles.stack} onBlur={() => setShowError(true)}>
      <InvocationGroup
        label={t("dataCatalog.apiResource.invocation.filter")}
        checked={usesFilter}
        disabled={disabled || !supportsFilter}
        unavailableReason={
          supportsFilter ? undefined : t("dataCatalog.apiResource.invocation.noFilterableFields")
        }
        onChange={(checked) => updateFilter(filter, checked)}
      >
        {usesFilter ? (
          <FilterTreeEditor
            apiFilter
            value={filter}
            fields={fields}
            {...(disabled
              ? { readOnly: true as const }
              : { onChange: (next: typeof filter) => updateFilter(next, true) })}
          />
        ) : null}
        {showError && currentError ? (
          <p className={styles.validationError} role="alert">
            {t(`dataCatalog.filter.errors.${currentError}`)}
          </p>
        ) : null}
      </InvocationGroup>
      <InvocationGroup
        label={t("dataCatalog.apiResource.testPaging")}
        disabled={disabled || !supportsPaging}
        checked={page !== undefined}
        unavailableReason={
          supportsPaging ? undefined : t("dataCatalog.apiResource.invocation.noPagingRule")
        }
        onChange={(checked) => {
          const next = { ...value };
          setPagingDraft({ offset: null, limit: null });
          if (checked) next.paging = { mode: "single" };
          else delete next.paging;
          onChange(next);
        }}
      >
        {page ? (
          <div className={styles.pagingParameters}>
            {(["offset", "limit"] as const).map((name) => {
              const id = `${pagingId}-${name}`;
              return (
                <Fragment key={name}>
                  <label htmlFor={id}>{t(`dataCatalog.apiResource.${name}`)}</label>
                  <InputNumber<string>
                    id={id}
                    stringMode
                    aria-invalid={showError && !validPageValue(pagingDraft[name])}
                    aria-describedby={showError && pagingInvalid ? pagingErrorId : undefined}
                    status={showError && !validPageValue(pagingDraft[name]) ? "error" : undefined}
                    disabled={disabled}
                    value={pagingDraft[name]}
                    onChange={(count) => {
                      setPagingDraft((previous) => ({ ...previous, [name]: count }));
                      if (!validPageValue(count)) return;
                      const nextPage = { ...page };
                      if (count === null) delete nextPage[name];
                      else nextPage[name] = Number(count);
                      onChange({ ...value, paging: nextPage });
                    }}
                  />
                </Fragment>
              );
            })}
          </div>
        ) : null}
        {showError && pagingInvalid ? (
          <p className={styles.validationError} id={pagingErrorId} role="alert">
            {t("dataCatalog.apiResource.errors.paging")}
          </p>
        ) : null}
      </InvocationGroup>
    </div>
  );
}
