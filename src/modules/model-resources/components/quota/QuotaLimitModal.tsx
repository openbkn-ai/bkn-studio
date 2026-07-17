/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, InputNumber, Modal, Radio, Select, Table } from "antd";
import type { RadioChangeEvent } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { ModelSeriesIcon } from "@/modules/model-resources/components/ModelSeriesIcon";
import {
  createModelQuota,
  getModelQuotaDetail,
  updateModelQuota,
} from "@/modules/model-resources/services/quota.service";
import type { ModelQuota, ModelQuotaDetail } from "@/modules/model-resources/types/quota";
import {
  formatForecastAmount,
  isQuotaConfigured,
  QUOTA_NUM_TYPE_OPTIONS,
  QUOTA_PRICE_TYPE_OPTIONS,
} from "@/modules/model-resources/utils/quota-display";

import styles from "./QuotaLimitModal.module.css";

type QuotaLimitModalProps = {
  mode: "create" | "edit";
  onClose: (refresh?: boolean) => void;
  open: boolean;
  record: ModelQuota | null;
};

type QuotaRow = {
  id: "in" | "out";
  labelKey: "modelResources.quotas.modal.input" | "modelResources.quotas.modal.output";
  tokens?: number;
  numType: number;
  referPrice?: number;
  forecast?: string;
  errors: {
    tokens?: boolean;
    referPrice?: boolean;
  };
};

function toDisplayNumType(value: number) {
  return value === 3 ? 6 : value;
}

function toBackendNumType(value: number) {
  return value === 6 ? 3 : value;
}

function createRowsFromRecord(
  record: Pick<
    ModelQuota | ModelQuotaDetail,
    | "billingType"
    | "currencyType"
    | "inputTokens"
    | "numType"
    | "outputTokens"
    | "priceType"
    | "referPriceIn"
    | "referPriceOut"
  >,
  billingType: "0" | "1",
): QuotaRow[] {
  const configured = isQuotaConfigured(record);

  return [
    {
      id: "in",
      labelKey: "modelResources.quotas.modal.input",
      tokens: configured ? record.inputTokens : undefined,
      numType: toDisplayNumType(record.numType?.[0] ?? 1),
      referPrice: configured && record.referPriceIn !== -1 ? record.referPriceIn : undefined,
      forecast: undefined,
      errors: {},
    },
    {
      id: "out",
      labelKey: "modelResources.quotas.modal.output",
      tokens:
        configured && billingType === "1" && record.outputTokens !== -1
          ? record.outputTokens
          : undefined,
      numType: toDisplayNumType(record.numType?.[1] ?? record.numType?.[0] ?? 1),
      referPrice:
        configured && billingType === "1" && record.referPriceOut !== -1
          ? record.referPriceOut
          : undefined,
      forecast: undefined,
      errors: {},
    },
  ];
}

function extractAmount(value?: string) {
  if (!value) {
    return 0;
  }

  const amount = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
}

export function QuotaLimitModal({ mode, onClose, open, record }: QuotaLimitModalProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [billingType, setBillingType] = useState<"0" | "1">("0");
  const [currencySymbol, setCurrencySymbol] = useState<"\uffe5" | "$">("\uffe5");
  const [priceType, setPriceType] = useState<"thousand" | "million">("thousand");
  const [rows, setRows] = useState<QuotaRow[]>([]);
  const [totalForecast, setTotalForecast] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const numTypeOptions = useMemo(
    () =>
      QUOTA_NUM_TYPE_OPTIONS.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
      })),
    [t],
  );

  const priceTypeOptions = useMemo(
    () =>
      QUOTA_PRICE_TYPE_OPTIONS.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
      })),
    [t],
  );

  const recalculateForecast = useCallback(
    (
      nextRows: QuotaRow[],
      nextBillingType: "0" | "1",
      nextPriceType = priceType,
      nextCurrencySymbol = currencySymbol,
    ) => {
      const updatedRows = nextRows.map((row) => {
        if (row.tokens === undefined || row.referPrice === undefined) {
          return { ...row, forecast: undefined };
        }

        return {
          ...row,
          forecast: formatForecastAmount(
            row.tokens,
            row.referPrice,
            toBackendNumType(row.numType),
            nextPriceType,
            nextCurrencySymbol,
          ),
        };
      });

      const inputForecast = updatedRows[0]?.forecast;
      const outputForecast = updatedRows[1]?.forecast;
      const nextTotal =
        nextBillingType === "1" && inputForecast && outputForecast
          ? `${nextCurrencySymbol}${(extractAmount(inputForecast) + extractAmount(outputForecast)).toFixed(2)}`
          : inputForecast ?? "";

      setRows(updatedRows);
      setTotalForecast(nextTotal);
    },
    [currencySymbol, priceType],
  );

  useEffect(() => {
    if (!open || !record) {
      return;
    }

    const initialize = async () => {
      setLoading(true);
      setShowErrors(false);

      try {
        const detail = mode === "edit" ? await getModelQuotaDetail(record.confId) : null;
        const source = detail ?? record;
        const nextBillingType =
          source.billingType === 1 ? "1" : source.billingType === 0 ? "0" : "0";
        const nextCurrencySymbol = source.currencyType === 1 ? "$" : "\uffe5";
        const nextPriceType = (source.priceType?.[0] as "thousand" | "million") ?? "thousand";

        setBillingType(nextBillingType);
        setCurrencySymbol(nextCurrencySymbol);
        setPriceType(nextPriceType);

        const nextRows = createRowsFromRecord(source, nextBillingType);
        recalculateForecast(nextRows, nextBillingType, nextPriceType, nextCurrencySymbol);
      } catch (error) {
        message.error(extractRequestErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };

    void initialize();
  }, [message, mode, open, recalculateForecast, record]);

  const updateRow = (rowId: QuotaRow["id"], patch: Partial<QuotaRow>) => {
    const nextRows = rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row));
    recalculateForecast(nextRows, billingType);
  };

  const handleBillingTypeChange = (event: RadioChangeEvent) => {
    const nextBillingType = event.target.value as "0" | "1";
    setBillingType(nextBillingType);
    recalculateForecast(rows, nextBillingType);
  };

  const validateRows = () => {
    const activeRows = billingType === "1" ? rows : rows.slice(0, 1);
    if (activeRows.length === 0) {
      setShowErrors(true);
      return false;
    }

    const nextRows = rows.map((row) => {
      if (!activeRows.some((activeRow) => activeRow.id === row.id)) {
        return { ...row, errors: {} };
      }

      return {
        ...row,
        errors: {
          tokens: row.tokens === undefined,
          referPrice: row.referPrice === undefined,
        },
      };
    });

    setRows(nextRows);
    setShowErrors(true);

    return nextRows.every((row) => {
      if (!activeRows.some((activeRow) => activeRow.id === row.id)) {
        return true;
      }

      return !row.errors.tokens && !row.errors.referPrice;
    });
  };

  const handleSubmit = async () => {
    if (!record || !validateRows()) {
      return;
    }

    const inputRow = rows[0];
    if (!inputRow) {
      return;
    }

    const outputRow = rows[1];
    const payload = {
      modelId: record.modelId,
      billingType: Number(billingType),
      currencyType: currencySymbol === "$" ? 1 : 0,
      inputTokens: inputRow.tokens ?? 0,
      referPriceIn: inputRow.referPrice ?? 0,
      numType: [
        toBackendNumType(inputRow.numType),
        toBackendNumType(outputRow?.numType ?? inputRow.numType),
      ],
      priceType: [priceType, priceType],
      ...(billingType === "1"
        ? {
            outputTokens: outputRow.tokens ?? 0,
            referPriceOut: outputRow.referPrice ?? 0,
          }
        : {}),
    };

    setSubmitting(true);

    try {
      const success =
        mode === "create"
          ? await createModelQuota(payload)
          : await updateModelQuota(record.confId, payload);

      if (!success) {
        throw new Error(t("modelResources.quotas.modal.saveFailed"));
      }

      message.success(t("modelResources.quotas.modal.saveSuccess"));
      onClose(true);
    } catch (error) {
      message.error(extractRequestErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const tableRows = billingType === "1" ? rows : rows.slice(0, 1);

  return (
    <Modal
      className={styles.quotaModal}
      destroyOnHidden
      footer={null}
      maskClosable={false}
      onCancel={() => onClose(false)}
      open={open}
      title={t("modelResources.quotas.modal.limitTitle")}
      width={860}
    >
      {record ? (
        <div className={styles.header}>
          <div className={styles.modelTitle}>
            <ModelSeriesIcon modelName={record.modelName} modelSeries={record.modelSeries} />
            <span className={styles.modelName}>{record.modelName}</span>
          </div>
          <div className={styles.modelMeta}>
            {t("modelResources.quotas.columns.model")}: {record.model}
          </div>
        </div>
      ) : null}

      <section className={styles.sectionPanel}>
        <div className={styles.sectionHeader}>
          <div>
            <div className={styles.sectionTitle}>{t("modelResources.quotas.modal.billingType")}</div>
            <div className={styles.sectionHint}>{t("modelResources.quotas.modal.quotaSetting")}</div>
          </div>
        </div>
        <Radio.Group
          buttonStyle="solid"
          className={styles.billingGroup}
          disabled={mode === "edit"}
          optionType="button"
          onChange={handleBillingTypeChange}
          value={billingType}
        >
          <Radio.Button value="0">{t("modelResources.quotas.modal.unifiedBilling")}</Radio.Button>
          <Radio.Button value="1">{t("modelResources.quotas.modal.separateBilling")}</Radio.Button>
        </Radio.Group>
      </section>

      <section className={styles.sectionPanel}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>{t("modelResources.quotas.modal.quotaSetting")}</div>
          <div className={styles.sectionMeta}>{t("modelResources.quotas.modal.perMonth")}</div>
        </div>
        <Table<QuotaRow>
          className={styles.quotaTable}
          columns={[
            {
              title: "",
              dataIndex: "labelKey",
              width: 96,
              render: (labelKey: QuotaRow["labelKey"]) => (
                <span className={styles.rowLabel}>{t(labelKey)}</span>
              ),
            },
            {
              title: t("modelResources.quotas.modal.tokensAmount"),
              dataIndex: "tokens",
              width: 300,
              render: (_value, row) => (
                <div className={styles.fieldCell}>
                  <div className={styles.controlLine}>
                    <InputNumber
                      className={styles.numberInput}
                      controls={false}
                      max={9999}
                      min={1}
                      onChange={(value) =>
                        updateRow(row.id, { tokens: typeof value === "number" ? value : undefined })
                      }
                      placeholder={t("modelResources.quotas.modal.enterPlaceholder")}
                      value={row.tokens}
                    />
                    <Select
                      className={styles.unitSelect}
                      options={numTypeOptions}
                      popupMatchSelectWidth={120}
                      value={row.numType}
                      onChange={(value) => updateRow(row.id, { numType: value })}
                    />
                    <span className={styles.inlineUnit}>{t("modelResources.quotas.modal.perMonth")}</span>
                  </div>
                  {showErrors && row.errors.tokens ? (
                    <span className={styles.errorText}>{t("modelResources.quotas.modal.required")}</span>
                  ) : null}
                </div>
              ),
            },
            {
              title: t("modelResources.quotas.modal.referencePrice"),
              dataIndex: "referPrice",
              width: 300,
              render: (_value, row) => (
                <div className={styles.fieldCell}>
                  <div className={`${styles.controlLine} ${styles.priceControlLine}`}>
                    <Select
                      className={styles.currencySelect}
                      options={[
                        { value: "CNY", label: "\uffe5" },
                        { value: "USD", label: "$" },
                      ]}
                      value={currencySymbol === "$" ? "USD" : "CNY"}
                      onChange={(value) => {
                        const nextSymbol = value === "USD" ? "$" : "\uffe5";
                        setCurrencySymbol(nextSymbol);
                        recalculateForecast(rows, billingType, priceType, nextSymbol);
                      }}
                    />
                    <InputNumber
                      className={styles.priceInput}
                      controls={false}
                      min={0}
                      onChange={(value) =>
                        updateRow(row.id, {
                          referPrice: typeof value === "number" ? value : undefined,
                        })
                      }
                      placeholder={t("modelResources.quotas.modal.enterPlaceholder")}
                      value={row.referPrice}
                    />
                    <Select
                      className={styles.priceTypeSelect}
                      options={priceTypeOptions}
                      value={priceType}
                      onChange={(value) => {
                        setPriceType(value);
                        recalculateForecast(rows, billingType, value, currencySymbol);
                      }}
                    />
                  </div>
                  {showErrors && row.errors.referPrice ? (
                    <span className={styles.errorText}>{t("modelResources.quotas.modal.required")}</span>
                  ) : null}
                </div>
              ),
            },
            {
              title: t("modelResources.quotas.modal.forecastTotal"),
              dataIndex: "forecast",
              width: 140,
              render: (value?: string) => (
                <span className={styles.forecastValue}>{value ?? "--"}</span>
              ),
            },
          ]}
          dataSource={tableRows}
          loading={loading}
          pagination={false}
          rowKey="id"
          size="small"
        />
      </section>

      <Alert
        className={styles.summary}
        message={t("modelResources.quotas.modal.estimatedTotal", { amount: totalForecast || "--" })}
        type="info"
      />

      <div className={styles.footer}>
        <div className={styles.primaryActions}>
          <AppButton onClick={() => onClose(false)}>{t("common.cancel")}</AppButton>
          <AppButton loading={submitting} type="primary" onClick={() => void handleSubmit()}>
            {t("common.save")}
          </AppButton>
        </div>
      </div>
    </Modal>
  );
}
