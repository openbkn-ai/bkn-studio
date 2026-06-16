import { CheckCircleFilled, ReloadOutlined } from "@ant-design/icons";
import { Alert, Input } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type {
  FilterValue,
  SorterResult,
  TableCurrentDataSource,
} from "antd/es/table/interface";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { usePageState } from "@/framework/hooks/use-page-state";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { ModelSeriesIcon } from "@/modules/model-resources/components/ModelSeriesIcon";
import {
  listLlmModels,
  setDefaultLlmModel,
} from "@/modules/model-resources/services/llm.service";
import type { LlmModel } from "@/modules/model-resources/types/llm";
import { getLlmModelTypeLabel } from "@/modules/model-resources/utils/llm-labels";

import styles from "./DefaultModelScene.module.css";
import pageStyles from "./model-resources-page.module.css";

type DefaultModelSortRule = "default" | "model_name" | "create_time" | "update_time";

export function DefaultModelScene() {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const { pageState, query, setKeyword, setPagination } = usePageState({
    pageSize: 10,
  });
  const [items, setItems] = useState<LlmModel[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settingModelId, setSettingModelId] = useState<string | null>(null);
  const [sortRule, setSortRule] = useState<DefaultModelSortRule>("default");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const result = await listLlmModels({
        page: query.page,
        size: query.pageSize,
        name: query.keyword,
        order: sortOrder,
        rule: sortRule,
      });

      setItems(result.items);
      setTotal(result.total);
    } catch (error) {
      setItems([]);
      setTotal(0);
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [query.keyword, query.page, query.pageSize, sortOrder, sortRule]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSetDefault = async (record: LlmModel) => {
    setSettingModelId(record.modelId);

    try {
      const result = await setDefaultLlmModel({
        modelId: record.modelId,
        default: true,
      });

      if (result.status !== "ok") {
        throw new Error(t("modelResources.defaultModel.setDefaultFailed"));
      }

      message.success(t("modelResources.defaultModel.setDefaultSuccess"));
      if (pageState.page !== 1) {
        setPagination(1, pageState.pageSize);
      } else {
        await loadData();
      }
    } catch (error) {
      message.error(extractRequestErrorMessage(error));
    } finally {
      setSettingModelId(null);
    }
  };

  const handleTableChange = (
    pagination: TablePaginationConfig,
    _filters: Record<string, FilterValue | null>,
    sorter: SorterResult<LlmModel> | SorterResult<LlmModel>[],
    _extra: TableCurrentDataSource<LlmModel>,
  ) => {
    const nextSorter = Array.isArray(sorter) ? sorter[0] : sorter;
    const nextPage = pagination.current ?? 1;
    const nextPageSize = pagination.pageSize ?? pageState.pageSize;

    if (nextSorter?.field && nextSorter.order) {
      setSortRule(String(nextSorter.field) as DefaultModelSortRule);
      setSortOrder(nextSorter.order === "ascend" ? "asc" : "desc");
    }

    setPagination(nextPage, nextPageSize);
  };

  const columns: ColumnsType<LlmModel> = [
    {
      title: t("modelResources.defaultModel.columns.modelName"),
      dataIndex: "modelName",
      key: "model_name",
      sorter: true,
      width: 240,
      fixed: "left",
      render: (_value, record) => (
        <div className={styles.modelNameCell} title={record.modelName}>
          <ModelSeriesIcon modelName={record.modelName} modelSeries={record.modelSeries} />
          <span className={styles.modelNameText}>{record.modelName}</span>
        </div>
      ),
    },
    {
      title: t("modelResources.defaultModel.columns.modelType"),
      dataIndex: "modelType",
      key: "model_type",
      width: 140,
      render: (value: string) => getLlmModelTypeLabel(value, t),
    },
    {
      title: t("modelResources.defaultModel.columns.baseModel"),
      dataIndex: "modelSeries",
      key: "model_series",
      width: 160,
      render: (value?: string) => value || "--",
    },
    {
      title: t("modelResources.defaultModel.columns.setting"),
      dataIndex: "default",
      key: "default",
      width: 180,
      render: (_value, record) => {
        if (record.default) {
          return (
            <span className={styles.defaultBadge}>
              <CheckCircleFilled className={styles.defaultIcon} />
              {t("modelResources.defaultModel.currentDefault")}
            </span>
          );
        }

        return (
          <PermissionGate permissions="model-resources:default-model:edit">
            <AppButton
              loading={settingModelId === record.modelId}
              onClick={() => {
                void handleSetDefault(record);
              }}
              size="small"
            >
              {t("modelResources.defaultModel.setAsDefault")}
            </AppButton>
          </PermissionGate>
        );
      },
    },
  ];

  return (
    <section className={pageStyles.page}>
      <div className={pageStyles.pageIntro}>
        <h2 className={pageStyles.pageIntroTitle}>{t("modelResources.defaultModel.title")}</h2>
        <p className={pageStyles.pageIntroDescription}>
          {t("modelResources.defaultModel.description")}
        </p>
      </div>

      <div className={pageStyles.toolbar}>
        <Input.Search
          allowClear
          className={pageStyles.searchInput}
          onSearch={(value) => setKeyword(value)}
          placeholder={t("modelResources.defaultModel.searchPlaceholder")}
        />
        <AppButton
          icon={<ReloadOutlined />}
          onClick={() => {
            void loadData();
          }}
        >
          {t("common.refresh")}
        </AppButton>
      </div>

      {loadError ? (
        <Alert
          message={loadError}
          showIcon
          style={{ marginBottom: 16 }}
          type="error"
          action={
            <AppButton
              onClick={() => {
                void loadData();
              }}
              size="small"
            >
              {t("common.retry")}
            </AppButton>
          }
        />
      ) : null}

      <div className={styles.tableWrap}>
        <AppTable<LlmModel>
          columns={columns}
          dataSource={items}
          loading={loading}
          locale={{
            emptyText: (
              <EmptyStatePanel
                description={t("modelResources.defaultModel.emptyDescription")}
                title={t("modelResources.defaultModel.emptyTitle")}
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
          rowKey="modelId"
          scroll={{ x: 760 }}
        />
      </div>
    </section>
  );
}
