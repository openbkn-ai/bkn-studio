/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { EllipsisOutlined, ExclamationCircleFilled, ExportOutlined } from "@ant-design/icons";
import { Alert, Dropdown, Tag } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { usePageState } from "@/framework/hooks/use-page-state";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { ModelSeriesIcon } from "@/modules/model-resources/components/ModelSeriesIcon";
import {
  LlmApiGuideDrawer,
  LlmModelFormModal,
  LlmMonitorDrawer,
} from "@/modules/model-resources/components/models/ModelModals";
import { ModelListToolbar } from "@/modules/model-resources/components/models/ModelListToolbar";
import { getMyPermissions } from "@/modules/model-resources/services/authorization.service";
import {
  deleteLlmModels,
  getLlmItemPermissions,
  listLlmModels,
  setDefaultLlmModel,
  testLlmModel,
} from "@/modules/model-resources/services/llm.service";
import type { LlmModel } from "@/modules/model-resources/types/llm";
import { hasModelResourcesAdminRole } from "@/modules/model-resources/utils/admin-access";
import { getLlmModelTypeLabel } from "@/modules/model-resources/utils/llm-labels";
import {
  formatNumberWithCommas,
  getModelSeriesLabel,
} from "@/modules/model-resources/utils/model-display";
import { buildLlmSavePayload, llmModelToFormValues } from "@/modules/model-resources/utils/model-form";
import {
  getModelTableColumnSortOrder,
  toggleModelSort,
} from "@/modules/model-resources/utils/model-table-sort";
import { ObjectAuthorizeDrawer } from "@/modules/system-admin/components/ObjectAuthorizeDrawer";

import styles from "./ModelListPanels.module.css";

type LargeModelSortRule = "model_name" | "create_time" | "update_time";

const LARGE_MODEL_SORT_FIELD_MAP: Record<string, LargeModelSortRule> = {
  modelName: "model_name",
  createTime: "create_time",
  updateTime: "update_time",
};

type LargeModelListPanelProps = {
  isAdmin?: boolean;
};

export function LargeModelListPanel({ isAdmin = false }: LargeModelListPanelProps) {
  const { t } = useTranslation();
  const { message, modal, runtimeConfig } = useAppServices();
  const { pageState, query, setKeyword, setPagination } = usePageState({ pageSize: 10 });
  const [items, setItems] = useState<LlmModel[]>([]);
  const [total, setTotal] = useState(0);
  const [modelType, setModelType] = useState("all");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sortRule, setSortRule] = useState<LargeModelSortRule>("update_time");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [activeRecord, setActiveRecord] = useState<LlmModel | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit" | "view">("create");
  const [formOpen, setFormOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [monitorOpen, setMonitorOpen] = useState(false);
  const [authorizeRecord, setAuthorizeRecord] = useState<LlmModel | null>(null);
  /** `/me/permissions`.is_admin — covers super_admin without literal role `"admin"`. */
  const [meIsAdmin, setMeIsAdmin] = useState(false);

  const effectiveAdmin =
    isAdmin || meIsAdmin || hasModelResourcesAdminRole(runtimeConfig.currentUser.roles);
  // Admins manage quotas via the form switch + quotas page; non-admins see usage columns.
  const showQuotaColumns = !effectiveAdmin;

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const result = await listLlmModels({
        page: query.page,
        size: query.pageSize,
        name: query.keyword,
        modelType,
        order: sortOrder,
        rule: sortRule,
      });

      const permissionMap = await getLlmItemPermissions(result.items.map((item) => item.modelId));
      setItems(
        result.items.map((item) => ({
          ...item,
          operations: permissionMap[item.modelId] ?? item.operations ?? [],
        })),
      );
      setTotal(result.total);
    } catch (error) {
      setItems([]);
      setTotal(0);
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [modelType, query.keyword, query.page, query.pageSize, sortOrder, sortRule]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    let cancelled = false;

    void getMyPermissions()
      .then((me) => {
        if (!cancelled) {
          setMeIsAdmin(me.isAdmin);
        }
      })
      .catch(() => {
        // Keep role-based fallback when /me/permissions is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const sortMenuItems = useMemo(
    () => [
      { key: "model_name", label: t("modelResources.models.sortByModelName") },
      { key: "create_time", label: t("modelResources.models.sortByCreation") },
      { key: "update_time", label: t("modelResources.models.sortByUpdate") },
    ],
    [t],
  );

  const sortAriaLabel = useMemo(() => {
    if (sortRule === "model_name") {
      return t("modelResources.models.sortByModelName");
    }

    if (sortRule === "create_time") {
      return t("modelResources.models.sortByCreation");
    }

    return t("modelResources.models.sortByUpdate");
  }, [sortRule, t]);

  const handleSortChange = (key: string) => {
    const nextRule = key as LargeModelSortRule;
    setSortOrder(toggleModelSort(nextRule, sortRule, sortOrder));
    setSortRule(nextRule);
    setPagination(1, pageState.pageSize);
  };

  const openForm = (mode: "create" | "edit" | "view", record: LlmModel | null = null) => {
    setFormMode(mode);
    setActiveRecord(record);
    setFormOpen(true);
  };

  const handleDelete = (records: LlmModel[]) => {
    void modal.confirm({
      title: t("modelResources.models.deleteConfirmTitle"),
      content: t("modelResources.models.deleteConfirmContent", {
        names: records.map((item) => `「${item.modelName}」`).join("、"),
      }),
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      onOk: async () => {
        const result = await deleteLlmModels(records.map((item) => item.modelId));
        if (result.status !== "ok") {
          throw new Error(t("modelResources.models.deleteFailed"));
        }
        message.success(t("modelResources.models.deleteSuccess"));
        setSelectedRowKeys([]);
        await loadData();
      },
    });
  };

  const handleTest = async (record: LlmModel) => {
    try {
      const payload = buildLlmSavePayload(llmModelToFormValues(record), record);
      const result = await testLlmModel(payload);
      if (result.status !== "ok") {
        throw new Error(t("modelResources.models.testFailed"));
      }
      message.success(t("modelResources.models.testSuccess"));
    } catch (error) {
      message.error(extractRequestErrorMessage(error));
    }
  };

  // 真实管理员：prop / roles(含 super_admin) / me.isAdmin，或该项 operations 含 modify。
  const canModify = (record: LlmModel) =>
    effectiveAdmin || Boolean(record.operations?.includes("modify"));
  const canSetDefault = (record: LlmModel) => canModify(record) && !record.default;
  const canUnsetDefault = (record: LlmModel) => canModify(record) && Boolean(record.default);

  const handleSetDefault = (record: LlmModel) => {
    void modal.confirm({
      title: t("modelResources.models.setDefaultLlmConfirmTitle"),
      icon: <ExclamationCircleFilled style={{ color: "#ff4d4f" }} />,
      content: t("modelResources.models.setDefaultLlmConfirmContent", { name: record.modelName }),
      okText: t("modelResources.models.setDefaultConfirmOk"),
      okButtonProps: { danger: true },
      cancelText: t("common.cancel"),
      onOk: async () => {
        const result = await setDefaultLlmModel(record.modelId);
        if (result.status !== "ok") {
          throw new Error(t("modelResources.models.setDefaultFailed"));
        }
        message.success(t("modelResources.models.setDefaultSuccess"));
        await loadData();
      },
    });
  };

  const handleUnsetDefault = (record: LlmModel) => {
    void modal.confirm({
      title: t("modelResources.models.unsetDefaultLlmConfirmTitle"),
      icon: <ExclamationCircleFilled style={{ color: "#ff4d4f" }} />,
      content: t("modelResources.models.unsetDefaultLlmConfirmContent", { name: record.modelName }),
      okText: t("modelResources.models.unsetDefaultConfirmOk"),
      okButtonProps: { danger: true },
      cancelText: t("common.cancel"),
      onOk: async () => {
        const result = await setDefaultLlmModel(record.modelId, false);
        if (result.status !== "ok") {
          throw new Error(t("modelResources.models.unsetDefaultFailed"));
        }
        message.success(t("modelResources.models.unsetDefaultSuccess"));
        await loadData();
      },
    });
  };

  const handleOperate = (key: string, record: LlmModel) => {
    if (key === "view") {
      openForm("view", record);
      return;
    }

    if (key === "setDefault" && canSetDefault(record)) {
      handleSetDefault(record);
      return;
    }

    if (key === "unsetDefault" && canUnsetDefault(record)) {
      handleUnsetDefault(record);
      return;
    }

    if (key === "edit") {
      openForm("edit", record);
      return;
    }

    if (key === "delete") {
      handleDelete([record]);
      return;
    }

    if (key === "test") {
      void handleTest(record);
      return;
    }

    if (key === "monitor") {
      setActiveRecord(record);
      setMonitorOpen(true);
      return;
    }

    if (key === "guide") {
      setActiveRecord(record);
      setGuideOpen(true);
      return;
    }

    if (key === "authorize") {
      setAuthorizeRecord(record);
    }
  };

  const columns: ColumnsType<LlmModel> = [
    {
      title: t("modelResources.models.columns.modelName"),
      dataIndex: "modelName",
      fixed: "left",
      showSorterTooltip: false,
      sortOrder: getModelTableColumnSortOrder(
        "modelName",
        LARGE_MODEL_SORT_FIELD_MAP,
        sortRule,
        sortOrder,
      ),
      sorter: true,
      width: 220,
      render: (_value, record) => (
        <div className={styles.nameCell}>
          <ModelSeriesIcon modelName={record.modelName} modelSeries={record.modelSeries} />
          <span title={record.modelName}>{record.modelName}</span>
          {record.default ? (
            <Tag color="blue">{t("modelResources.models.defaultTag")}</Tag>
          ) : null}
        </div>
      ),
    },
    {
      title: t("modelResources.models.columns.operation"),
      dataIndex: "operation",
      fixed: "left",
      width: 72,
      render: (_value, record) => (
        <Dropdown
          menu={{
            items: [
              { key: "view", label: t("modelResources.models.menus.view") },
              { key: "edit", label: t("modelResources.models.menus.edit") },
              { key: "delete", label: t("modelResources.models.menus.delete") },
              { key: "test", label: t("modelResources.models.menus.testConnection") },
              canSetDefault(record)
                ? { key: "setDefault", label: t("modelResources.models.menus.setAsDefault") }
                : null,
              canUnsetDefault(record)
                ? { key: "unsetDefault", label: t("modelResources.models.menus.unsetDefault") }
                : null,
              { key: "monitor", label: t("modelResources.models.menus.modelMonitoring") },
              { key: "authorize", label: t("modelResources.models.menus.authorizationManagement") },
            ].filter(Boolean),
            onClick: ({ key, domEvent }) => {
              domEvent.stopPropagation();
              handleOperate(key, record);
            },
          }}
          trigger={["click"]}
        >
          <AppButton
            aria-label={t("modelResources.models.columns.operation")}
            icon={<EllipsisOutlined />}
            type="text"
            onClick={(event) => event.stopPropagation()}
          />
        </Dropdown>
      ),
    },
    {
      title: t("modelResources.models.columns.modelType"),
      dataIndex: "modelType",
      width: 180,
      render: (value: string) => getLlmModelTypeLabel(value, t),
    },
    {
      title: t("modelResources.models.columns.baseModel"),
      dataIndex: "modelSeries",
      width: 140,
      render: (value?: string) => getModelSeriesLabel(value),
    },
    {
      title: t("modelResources.models.columns.document"),
      dataIndex: "document",
      width: 140,
      render: (_value, record) => (
        <AppButton
          icon={<ExportOutlined />}
          iconPosition="end"
          type="link"
          onClick={(event) => {
            event.stopPropagation();
            handleOperate("guide", record);
          }}
        >
          {t("modelResources.models.apiGuide.title")}
        </AppButton>
      ),
    },
    {
      title: t("modelResources.models.columns.maximumContext"),
      dataIndex: "maxModelLen",
      width: 110,
      render: (value?: number) => (value ? `${value} K` : "--"),
    },
    {
      title: t("modelResources.models.columns.parameterQuantity"),
      dataIndex: "modelParameters",
      width: 100,
      render: (value?: number) => (value ? `${value} B` : "--"),
    },
    {
      title: t("modelResources.models.columns.creator"),
      dataIndex: "createBy",
      width: 120,
      render: (value?: string) => value || "--",
    },
    {
      title: t("modelResources.models.columns.createdTime"),
      dataIndex: "createTime",
      showSorterTooltip: false,
      sortOrder: getModelTableColumnSortOrder(
        "createTime",
        LARGE_MODEL_SORT_FIELD_MAP,
        sortRule,
        sortOrder,
      ),
      sorter: true,
      width: 170,
      render: (value?: string) => (value ? dayjs(value).format("YYYY/MM/DD HH:mm:ss") : "--"),
    },
    {
      title: t("modelResources.models.columns.finalOperator"),
      dataIndex: "updateBy",
      width: 120,
      render: (value?: string) => value || "--",
    },
    ...(showQuotaColumns
      ? ([
          {
            title: t("modelResources.models.columns.tokensCount"),
            dataIndex: "inputTokens",
            width: 160,
            render: (_value: number | undefined, record: LlmModel) => {
              if (!record.quota) {
                return t("modelResources.models.columns.unlimitedQuota");
              }

              if (record.billingType === 1) {
                return (
                  <div className={styles.multiLineCell}>
                    <div>
                      {t("modelResources.models.columns.in")}：
                      {formatNumberWithCommas(record.inputTokens)}
                    </div>
                    <div>
                      {t("modelResources.models.columns.out")}：
                      {formatNumberWithCommas(record.outputTokens)}
                    </div>
                  </div>
                );
              }

              return formatNumberWithCommas(record.inputTokens);
            },
          },
          {
            title: t("modelResources.models.columns.alreadyTokens"),
            dataIndex: "inputsUsed",
            width: 160,
            render: (_value: number | undefined, record: LlmModel) => {
              if (!record.quota) {
                return t("modelResources.models.columns.unlimitedQuota");
              }

              if (record.billingType === 1) {
                return (
                  <div className={styles.multiLineCell}>
                    <div>
                      {t("modelResources.models.columns.in")}：
                      {formatNumberWithCommas(record.inputsUsed)}
                    </div>
                    <div>
                      {t("modelResources.models.columns.out")}：
                      {formatNumberWithCommas(record.outputsUsed)}
                    </div>
                  </div>
                );
              }

              return formatNumberWithCommas(record.inputsUsed);
            },
          },
          {
            title: t("modelResources.models.columns.remainingCounts"),
            dataIndex: "inputsLeft",
            width: 160,
            render: (_value: number | undefined, record: LlmModel) => {
              if (!record.quota) {
                return t("modelResources.models.columns.unlimitedQuota");
              }

              if (record.billingType === 1) {
                return (
                  <div className={styles.multiLineCell}>
                    <div>
                      {t("modelResources.models.columns.in")}：
                      {formatNumberWithCommas(record.inputsLeft)}
                    </div>
                    <div>
                      {t("modelResources.models.columns.out")}：
                      {formatNumberWithCommas(record.outputsLeft)}
                    </div>
                  </div>
                );
              }

              return formatNumberWithCommas(record.inputsLeft);
            },
          },
        ] as ColumnsType<LlmModel>)
      : []),
    {
      title: t("modelResources.models.columns.finalOperatedTime"),
      dataIndex: "updateTime",
      showSorterTooltip: false,
      sortOrder: getModelTableColumnSortOrder(
        "updateTime",
        LARGE_MODEL_SORT_FIELD_MAP,
        sortRule,
        sortOrder,
      ),
      sorter: true,
      width: 170,
      render: (value?: string) => (value ? dayjs(value).format("YYYY/MM/DD HH:mm:ss") : "--"),
    },
  ];

  const handleTableChange = (
    pagination: TablePaginationConfig,
    _filters: unknown,
    sorter: SorterResult<LlmModel> | SorterResult<LlmModel>[],
  ) => {
    const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter;

    if (activeSorter?.field && activeSorter.order) {
      const mappedRule = LARGE_MODEL_SORT_FIELD_MAP[String(activeSorter.field)];
      if (mappedRule) {
        setSortRule(mappedRule);
        setSortOrder(activeSorter.order === "ascend" ? "asc" : "desc");
      }
    }

    setPagination(pagination.current ?? 1, pagination.pageSize ?? pageState.pageSize);
  };

  return (
    <div className={styles.panel}>
      <ModelListToolbar
        createPermissions="model-resources:model:create"
        deleteDisabled={selectedRowKeys.length === 0}
        deletePermissions="model-resources:model:delete"
        modelType={modelType}
        modelTypeOptions={[
          { value: "all", label: t("modelResources.models.all") },
          { value: "llm", label: t("modelResources.models.types.llmFull") },
          { value: "rlm", label: t("modelResources.models.types.rlmFull") },
          { value: "vu", label: t("modelResources.models.types.vuFull") },
        ]}
        onCreate={() => openForm("create")}
        onDelete={() =>
          handleDelete(items.filter((item) => selectedRowKeys.includes(item.modelId)))
        }
        onModelTypeChange={(value) => {
          setModelType(value);
          setPagination(1, pageState.pageSize);
        }}
        onRefresh={() => void loadData()}
        onSearch={setKeyword}
        onSortChange={handleSortChange}
        refreshing={loading}
        searchDefaultValue={pageState.keyword}
        sortAriaLabel={sortAriaLabel}
        sortMenuItems={sortMenuItems}
        sortRule={sortRule}
      />

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

      <AppTable<LlmModel>
        columns={columns}
        dataSource={items}
        loading={loading}
        locale={{
          emptyText: (
            <EmptyStatePanel
              description={t("modelResources.models.emptyDescription")}
              title={t("modelResources.models.emptyTitle")}
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
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys.map(String)),
        }}
        scroll={{ x: showQuotaColumns ? 2200 : 1700 }}
      />

      <LlmModelFormModal
        mode={formMode}
        onClose={(refresh) => {
          setFormOpen(false);
          setActiveRecord(null);
          if (refresh) {
            void loadData();
          }
        }}
        open={formOpen}
        record={activeRecord}
        showQuotaField={effectiveAdmin}
      />
      <LlmApiGuideDrawer
        onClose={() => {
          setGuideOpen(false);
          setActiveRecord(null);
        }}
        open={guideOpen}
        record={activeRecord}
      />
      <LlmMonitorDrawer
        onClose={() => {
          setMonitorOpen(false);
          setActiveRecord(null);
        }}
        open={monitorOpen}
        record={activeRecord}
      />
      {authorizeRecord ? (
        <ObjectAuthorizeDrawer
          objId={authorizeRecord.modelId}
          objName={authorizeRecord.modelName}
          objSub={authorizeRecord.modelType}
          objType="large_model"
          onClose={() => setAuthorizeRecord(null)}
          open={Boolean(authorizeRecord)}
        />
      ) : null}
    </div>
  );
}
