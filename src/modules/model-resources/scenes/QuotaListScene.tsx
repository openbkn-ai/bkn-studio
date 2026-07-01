/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { EllipsisOutlined, ReloadOutlined, SortAscendingOutlined } from "@ant-design/icons";
import { Alert, Dropdown, Input, Select } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { usePageState } from "@/framework/hooks/use-page-state";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { ModelSeriesIcon } from "@/modules/model-resources/components/ModelSeriesIcon";
import { QuotaLimitModal } from "@/modules/model-resources/components/quota/QuotaLimitModal";
import { QuotaUserModal } from "@/modules/model-resources/components/quota/QuotaUserModal";
import { listModelQuotas } from "@/modules/model-resources/services/quota.service";
import type { ModelQuota } from "@/modules/model-resources/types/quota";
import {
  formatEstimatedTotal,
  formatQuotaTokenAmount,
  formatReferPrice,
  isQuotaConfigured,
} from "@/modules/model-resources/utils/quota-display";

import pageStyles from "./model-resources-page.module.css";
import styles from "./QuotaListScene.module.css";
import toolbarStyles from "../components/models/ModelListPanels.module.css";

type QuotaSortRule = "model_name" | "total_price" | "update_time";

export function QuotaListScene() {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const { pageState, query, setKeyword, setPagination } = usePageState({
    pageSize: 10,
  });
  const [items, setItems] = useState<ModelQuota[]>([]);
  const [total, setTotal] = useState(0);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [apiModel, setApiModel] = useState("all");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sortRule, setSortRule] = useState<QuotaSortRule>("update_time");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [activeRecord, setActiveRecord] = useState<ModelQuota | null>(null);
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [limitModalMode, setLimitModalMode] = useState<"create" | "edit">("create");
  const [userModalOpen, setUserModalOpen] = useState(false);

  const monthLabel = t("modelResources.quotas.month");
  const inLabel = t("modelResources.quotas.in");
  const outLabel = t("modelResources.quotas.out");
  const thousandLabel = t("modelResources.quotas.units.thousandTokens");
  const millionLabel = t("modelResources.quotas.units.millionTokens");

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const result = await listModelQuotas({
        page: query.page,
        size: query.pageSize,
        name: query.keyword,
        apiModel,
        order: sortOrder,
        rule: sortRule,
      });

      setItems(result.items);
      setTotal(result.total);
      setModelOptions(result.modelOptions);
    } catch (error) {
      setItems([]);
      setTotal(0);
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [apiModel, query.keyword, query.page, query.pageSize, sortOrder, sortRule]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const sortMenuItems = useMemo(
    () => [
      { key: "model_name", label: t("modelResources.quotas.sortByName") },
      { key: "total_price", label: t("modelResources.quotas.sortByCount") },
      { key: "update_time", label: t("modelResources.quotas.finalOperatorTime") },
    ],
    [t],
  );

  const handleOperate = (key: string, record: ModelQuota) => {
    if (!isQuotaConfigured(record) && key === "distribution") {
      message.warning(t("modelResources.quotas.quotaModalTip"));
      return;
    }

    setActiveRecord(record);

    if (key === "limit") {
      setLimitModalMode(isQuotaConfigured(record) ? "edit" : "create");
      setLimitModalOpen(true);
      return;
    }

    if (key === "distribution") {
      setUserModalOpen(true);
    }
  };

  const columns: ColumnsType<ModelQuota> = [
    {
      title: t("modelResources.quotas.columns.name"),
      dataIndex: "modelName",
      width: 280,
      fixed: "left",
      render: (_value, record) => (
        <div className={styles.modelNameCell}>
          <ModelSeriesIcon modelName={record.modelName} modelSeries={record.modelSeries} />
          <span title={record.modelName}>{record.modelName}</span>
        </div>
      ),
    },
    {
      title: t("modelResources.quotas.columns.operate"),
      dataIndex: "operate",
      width: 72,
      fixed: "left",
      render: (_value, record) => (
        <Dropdown
          menu={{
            items: [
              { key: "limit", label: t("modelResources.quotas.quotaSet") },
              { key: "distribution", label: t("modelResources.quotas.userQuota") },
            ],
            onClick: ({ key, domEvent }) => {
              domEvent.stopPropagation();
              handleOperate(key, record);
            },
          }}
          trigger={["click"]}
        >
          <AppButton
            aria-label={t("modelResources.quotas.columns.operate")}
            icon={<EllipsisOutlined />}
            type="text"
            onClick={(event) => event.stopPropagation()}
          />
        </Dropdown>
      ),
    },
    {
      title: t("modelResources.quotas.columns.model"),
      dataIndex: "model",
      ellipsis: true,
      width: 220,
    },
    {
      title: t("modelResources.quotas.columns.tokensCount"),
      dataIndex: "inputTokens",
      width: 260,
      render: (_value, record) => {
        if (!isQuotaConfigured(record)) {
          return "--";
        }

        if (record.billingType === 1) {
          return (
            <div className={styles.multiLineCell}>
              <div>
                {inLabel}：
                {formatQuotaTokenAmount(record.inputTokens, record.numType[0], monthLabel)}
              </div>
              <div>
                {outLabel}：
                {formatQuotaTokenAmount(record.outputTokens, record.numType[1], monthLabel)}
              </div>
            </div>
          );
        }

        return formatQuotaTokenAmount(record.inputTokens, record.numType[0], monthLabel);
      },
    },
    {
      title: t("modelResources.quotas.columns.price"),
      dataIndex: "referPriceIn",
      width: 280,
      render: (_value, record) => {
        if (!isQuotaConfigured(record)) {
          return "--";
        }

        if (record.billingType === 1) {
          return (
            <div className={styles.multiLineCell}>
              <div>{formatReferPrice(record, "in", inLabel, outLabel, thousandLabel, millionLabel)}</div>
              <div>{formatReferPrice(record, "out", inLabel, outLabel, thousandLabel, millionLabel)}</div>
            </div>
          );
        }

        return formatReferPrice(record, "in", inLabel, outLabel, thousandLabel, millionLabel);
      },
    },
    {
      title: t("modelResources.quotas.columns.totalPrice"),
      dataIndex: "totalPrice",
      width: 160,
      render: (_value, record) => formatEstimatedTotal(record),
    },
    {
      title: t("modelResources.quotas.columns.updateTime"),
      dataIndex: "updateTime",
      width: 180,
      render: (value?: string) => value || "--",
    },
  ];

  const handleTableChange = (pagination: TablePaginationConfig) => {
    setPagination(pagination.current ?? 1, pagination.pageSize ?? pageState.pageSize);
  };

  const handleSortChange = (key: string) => {
    const nextRule = key as QuotaSortRule;
    setSortRule(nextRule);
    setSortOrder(nextRule !== sortRule ? "desc" : sortOrder === "desc" ? "asc" : "desc");
    setPagination(1, pageState.pageSize);
  };

  const closeLimitModal = (refresh?: boolean) => {
    setLimitModalOpen(false);
    setActiveRecord(null);

    if (refresh) {
      void loadData();
    }
  };

  const closeUserModal = (refresh?: boolean) => {
    setUserModalOpen(false);
    setActiveRecord(null);

    if (refresh) {
      void loadData();
    }
  };

  return (
    <section className={pageStyles.page}>
      <div className={pageStyles.pageIntro}>
        <h2 className={pageStyles.pageIntroTitle}>{t("modelResources.quotas.title")}</h2>
        <p className={pageStyles.pageIntroDescription}>{t("modelResources.quotas.description")}</p>
      </div>

      <div className={pageStyles.toolbar}>
        <Input.Search
          allowClear
          className={pageStyles.searchInput}
          onSearch={(value) => setKeyword(value)}
          placeholder={t("modelResources.quotas.searchPlaceholder")}
        />
        <Select
          className={styles.modelFilter}
          options={[
            { value: "all", label: t("modelResources.quotas.all") },
            ...modelOptions.map((model) => ({ value: model, label: model })),
          ]}
          value={apiModel}
          onChange={(value) => {
            setApiModel(value);
            setPagination(1, pageState.pageSize);
          }}
        />
        <Dropdown
          menu={{
            items: sortMenuItems,
            selectedKeys: [sortRule],
            onClick: ({ key }) => handleSortChange(key),
          }}
          trigger={["click"]}
        >
          <button
            aria-label={t("modelResources.quotas.finalOperatorTime")}
            className={toolbarStyles.iconButton}
            type="button"
          >
            <SortAscendingOutlined />
          </button>
        </Dropdown>
        <AppButton icon={<ReloadOutlined />} onClick={() => void loadData()}>
          {t("common.refresh")}
        </AppButton>
      </div>

      {loadError ? (
        <Alert
          action={
            <AppButton onClick={() => void loadData()} size="small">
              {t("common.retry")}
            </AppButton>
          }
          message={loadError}
          showIcon
          style={{ marginBottom: 16 }}
          type="error"
        />
      ) : null}

      <div className={pageStyles.body}>
        <AppTable<ModelQuota>
          columns={columns}
          dataSource={items}
          loading={loading}
          locale={{
            emptyText: (
              <EmptyStatePanel
                description={t("modelResources.quotas.emptyDescription")}
                title={t("modelResources.quotas.emptyTitle")}
              />
            ),
          }}
          onChange={handleTableChange}
          pagination={{
            current: pageState.page,
            pageSize: pageState.pageSize,
            showSizeChanger: true,
            total,
          }}
          rowKey="confId"
          scroll={{ x: 1280 }}
        />
      </div>

      <QuotaLimitModal
        mode={limitModalMode}
        onClose={closeLimitModal}
        open={limitModalOpen}
        record={activeRecord}
      />
      <QuotaUserModal onClose={closeUserModal} open={userModalOpen} record={activeRecord} />
    </section>
  );
}
