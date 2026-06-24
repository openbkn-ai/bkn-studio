import { EllipsisOutlined, ExportOutlined } from "@ant-design/icons";
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
import { SmallModelApiGuideDrawer } from "@/modules/model-resources/components/models/ModelModals";
import { ModelListToolbar } from "@/modules/model-resources/components/models/ModelListToolbar";
import { SmallModelFormModal } from "@/modules/model-resources/components/models/SmallModelFormModal";
import {
  deleteSmallModels,
  getSmallModelItemPermissions,
  getSmallModelRolePermissions,
  listSmallModels,
  setDefaultSmallModel,
  testSmallModel,
} from "@/modules/model-resources/services/small-model.service";
import type { SmallModel } from "@/modules/model-resources/types/small-model";
import {
  buildSmallModelSavePayload,
  smallModelToFormValues,
} from "@/modules/model-resources/utils/model-form";
import {
  getModelTableColumnSortOrder,
  toggleModelSort,
} from "@/modules/model-resources/utils/model-table-sort";
import { ObjectAuthorizeDrawer } from "@/modules/system-admin/components/ObjectAuthorizeDrawer";

import styles from "./ModelListPanels.module.css";

type SmallModelSortRule = "model_name" | "create_time";

const SMALL_MODEL_SORT_FIELD_MAP: Record<string, SmallModelSortRule> = {
  modelName: "model_name",
  createTime: "create_time",
};

export function SmallModelListPanel() {
  const { t } = useTranslation();
  const { message, modal, runtimeConfig } = useAppServices();
  const isAdmin = runtimeConfig.currentUser.roles.includes("admin");
  const { pageState, query, setKeyword, setPagination } = usePageState({ pageSize: 10 });
  const [items, setItems] = useState<SmallModel[]>([]);
  const [total, setTotal] = useState(0);
  const [modelType, setModelType] = useState("all");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sortRule, setSortRule] = useState<SmallModelSortRule>("create_time");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [canCreate, setCanCreate] = useState(true);
  const [activeRecord, setActiveRecord] = useState<SmallModel | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit" | "view">("create");
  const [formOpen, setFormOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [authorizeRecord, setAuthorizeRecord] = useState<SmallModel | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const result = await listSmallModels({
        page: query.page,
        size: query.pageSize,
        name: query.keyword,
        modelType,
        order: sortOrder,
        rule: sortRule,
      });

      const permissionMap = await getSmallModelItemPermissions(result.items.map((item) => item.modelId));
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
    void getSmallModelRolePermissions().then((operations) => {
      setCanCreate(isAdmin || operations.includes("create"));
    });
  }, [isAdmin]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const sortMenuItems = useMemo(
    () => [
      { key: "model_name", label: t("modelResources.models.sortByModelName") },
      { key: "create_time", label: t("modelResources.models.sortByCreation") },
    ],
    [t],
  );

  const sortAriaLabel = useMemo(
    () =>
      sortRule === "model_name"
        ? t("modelResources.models.sortByModelName")
        : t("modelResources.models.sortByCreation"),
    [sortRule, t],
  );

  const handleSortChange = (key: string) => {
    const nextRule = key as SmallModelSortRule;
    setSortOrder(toggleModelSort(nextRule, sortRule, sortOrder));
    setSortRule(nextRule);
    setPagination(1, pageState.pageSize);
  };

  const openForm = (mode: "create" | "edit" | "view", record: SmallModel | null = null) => {
    setFormMode(mode);
    setActiveRecord(record);
    setFormOpen(true);
  };

  const handleDelete = (records: SmallModel[]) => {
    void modal.confirm({
      title: t("modelResources.models.deleteConfirmTitle"),
      content: t("modelResources.models.deleteConfirmContent", {
        names: records.map((item) => `「${item.modelName}」`).join("、"),
      }),
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      onOk: async () => {
        const result = await deleteSmallModels(records.map((item) => item.modelId));
        if (result.status !== "ok") {
          throw new Error(t("modelResources.models.deleteFailed"));
        }
        message.success(t("modelResources.models.deleteSuccess"));
        setSelectedRowKeys([]);
        await loadData();
      },
    });
  };

  const handleTest = async (record: SmallModel) => {
    try {
      const payload = buildSmallModelSavePayload(smallModelToFormValues(record), record);
      const result = await testSmallModel(payload);
      if (result.status !== "ok") {
        throw new Error(t("modelResources.models.testFailed"));
      }
      message.success(t("modelResources.models.testSuccess"));
    } catch (error) {
      message.error(extractRequestErrorMessage(error));
    }
  };

  const canModify = (record: SmallModel) => isAdmin || record.operations?.includes("modify");
  const canDelete = (record: SmallModel) => isAdmin || record.operations?.includes("delete");
  const canAuthorize = (record: SmallModel) => isAdmin || record.operations?.includes("authorize");
  const canSetDefault = (record: SmallModel) =>
    (record.modelType === "embedding" || record.modelType === "reranker") &&
    !record.default &&
    Boolean(canModify(record));

  const handleSetDefault = (record: SmallModel) => {
    void modal.confirm({
      title: t("modelResources.models.setDefaultConfirmTitle"),
      content: t("modelResources.models.setDefaultConfirmContent", {
        name: record.modelName,
        type: record.modelType,
      }),
      okText: t("common.confirm"),
      cancelText: t("common.cancel"),
      onOk: async () => {
        const result = await setDefaultSmallModel(record.modelId);
        if (result.status !== "ok") {
          throw new Error(t("modelResources.models.setDefaultFailed"));
        }
        message.success(t("modelResources.models.setDefaultSuccess"));
        await loadData();
      },
    });
  };

  const handleOperate = (key: string, record: SmallModel) => {
    if (key === "view") {
      openForm("view", record);
      return;
    }

    if (key === "edit" && canModify(record)) {
      openForm("edit", record);
      return;
    }

    if (key === "delete" && canDelete(record)) {
      handleDelete([record]);
      return;
    }

    if (key === "test") {
      void handleTest(record);
      return;
    }

    if (key === "guide") {
      setActiveRecord(record);
      setGuideOpen(true);
      return;
    }

    if (key === "setDefault" && canSetDefault(record)) {
      handleSetDefault(record);
      return;
    }

    if (key === "authorize" && canAuthorize(record)) {
      setAuthorizeRecord(record);
    }
  };

  const columns: ColumnsType<SmallModel> = [
    {
      title: t("modelResources.models.columns.modelName"),
      dataIndex: "modelName",
      fixed: "left",
      showSorterTooltip: false,
      sortOrder: getModelTableColumnSortOrder(
        "modelName",
        SMALL_MODEL_SORT_FIELD_MAP,
        sortRule,
        sortOrder,
      ),
      sorter: true,
      width: 220,
      render: (_value, record) => (
        <div className={styles.nameCell}>
          <ModelSeriesIcon modelName={record.modelName} />
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
      render: (_value, record) => {
        const menuItems = [
          { key: "view", label: t("modelResources.models.menus.view") },
          canModify(record) ? { key: "edit", label: t("modelResources.models.menus.edit") } : null,
          canDelete(record) ? { key: "delete", label: t("modelResources.models.menus.delete") } : null,
          { key: "test", label: t("modelResources.models.menus.testConnection") },
          canSetDefault(record)
            ? { key: "setDefault", label: t("modelResources.models.menus.setAsDefault") }
            : null,
          canAuthorize(record)
            ? { key: "authorize", label: t("modelResources.models.menus.authorizationManagement") }
            : null,
        ].filter(Boolean) as { key: string; label: string }[];

        return (
          <Dropdown
            menu={{
              items: menuItems,
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
        );
      },
    },
    {
      title: t("modelResources.models.columns.modelType"),
      dataIndex: "modelType",
      width: 140,
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
        SMALL_MODEL_SORT_FIELD_MAP,
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
    {
      title: t("modelResources.models.columns.finalOperatedTime"),
      dataIndex: "updateTime",
      width: 170,
      render: (value?: string) => (value ? dayjs(value).format("YYYY/MM/DD HH:mm:ss") : "--"),
    },
  ];

  const handleTableChange = (
    pagination: TablePaginationConfig,
    _filters: unknown,
    sorter: SorterResult<SmallModel> | SorterResult<SmallModel>[],
  ) => {
    const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter;

    if (activeSorter?.field && activeSorter.order) {
      const mappedRule = SMALL_MODEL_SORT_FIELD_MAP[String(activeSorter.field)];
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
        canCreate={canCreate}
        deleteDisabled={selectedRowKeys.length === 0}
        modelType={modelType}
        modelTypeOptions={[
          { value: "all", label: t("modelResources.models.all") },
          { value: "embedding", label: "embedding" },
          { value: "reranker", label: "reranker" },
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

      <AppTable<SmallModel>
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
        scroll={{ x: 1280 }}
      />

      <SmallModelFormModal
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
      />
      <SmallModelApiGuideDrawer
        onClose={() => {
          setGuideOpen(false);
          setActiveRecord(null);
        }}
        open={guideOpen}
        record={activeRecord}
      />
      {authorizeRecord ? (
        <ObjectAuthorizeDrawer
          objId={authorizeRecord.modelId}
          objName={authorizeRecord.modelName}
          objSub={authorizeRecord.modelType}
          objType="small_model"
          onClose={() => setAuthorizeRecord(null)}
          open={Boolean(authorizeRecord)}
        />
      ) : null}
    </div>
  );
}
