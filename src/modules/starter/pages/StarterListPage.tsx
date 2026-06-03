import { ReloadOutlined } from "@ant-design/icons";
import { Alert, Input, Space, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { RouteLoading } from "@/app/router/RouteLoading";
import { usePageState } from "@/framework/hooks/use-page-state";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { CrudListPage } from "@/framework/scaffold/CrudListPage";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { useAppServices } from "@/framework/context/use-app-services";
import {
  listStarterRecords,
  toggleStarterRecord,
} from "@/modules/starter/services/starter.service";
import type { StarterRecord } from "@/modules/starter/types/starter";

import styles from "./StarterListPage.module.css";

const StarterDetailDrawer = lazy(async () => {
  const module = await import("@/modules/starter/pages/StarterDetailDrawer");
  return { default: module.StarterDetailDrawer };
});

export function StarterListPage() {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const navigate = useNavigate();
  const { pageState, query, reset, setKeyword, setPagination } = usePageState();
  const [items, setItems] = useState<StarterRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailRecord, setDetailRecord] = useState<StarterRecord | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const result = await listStarterRecords(query);
      setItems(result.items);
      setTotal(result.total);
    } catch (error) {
      setItems([]);
      setTotal(0);
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const detailTranslations = useMemo(
    () => ({
      detailTitle: t("starter.detailTitle"),
      name: t("starter.name"),
      owner: t("starter.owner"),
      status: t("common.status"),
      updatedAt: t("starter.updatedAt"),
      statusDisabled: t("starter.statusDisabled"),
      statusEnabled: t("starter.statusEnabled"),
    }),
    [t],
  );

  const columns: ColumnsType<StarterRecord> = [
    {
      dataIndex: "name",
      title: t("starter.name"),
    },
    {
      dataIndex: "owner",
      title: t("starter.owner"),
    },
    {
      dataIndex: "status",
      title: t("common.status"),
      render: (status: StarterRecord["status"]) => (
        <Tag
          className={styles.statusTag}
          color={status === "enabled" ? "green" : "default"}
        >
          {status === "enabled"
            ? t("starter.statusEnabled")
            : t("starter.statusDisabled")}
        </Tag>
      ),
    },
    {
      dataIndex: "updatedAt",
      title: t("starter.updatedAt"),
    },
    {
      key: "actions",
      title: t("common.actions"),
      render: (_, record) => (
        <Space className={styles.actionGroup}>
          <AppButton onClick={() => setDetailRecord(record)} type="link">
            {t("common.detail")}
          </AppButton>
          <PermissionGate permissions="starter:edit">
            <AppButton
              onClick={() => {
                void navigate(`/starter/${record.id}/edit`);
              }}
              type="link"
            >
              {t("common.edit")}
            </AppButton>
          </PermissionGate>
          <PermissionGate permissions="starter:toggle">
            <AppButton
              onClick={() => {
                void (async () => {
                  try {
                    await toggleStarterRecord(record.id);
                    message.success(t("common.success"));
                    await loadData();
                  } catch (error) {
                    void message.error(extractRequestErrorMessage(error));
                  }
                })();
              }}
              type="link"
            >
              {record.status === "enabled"
                ? t("common.disabled")
                : t("common.enabled")}
            </AppButton>
          </PermissionGate>
        </Space>
      ),
    },
  ];

  return (
    <>
      <CrudListPage
        description={t("starter.description")}
        title={t("starter.title")}
        toolbar={
          <div className={styles.searchRow}>
            <Input.Search
              allowClear
              className={styles.searchInput}
              onSearch={setKeyword}
              placeholder={t("starter.searchPlaceholder")}
            />
            <div className={styles.toolbarActions}>
              <AppButton
                icon={<ReloadOutlined />}
                onClick={() => {
                  reset();
                }}
              >
                {t("common.refresh")}
              </AppButton>
              <PermissionGate permissions="starter:create">
                <AppButton
                  onClick={() => {
                    void navigate("/starter/new");
                  }}
                  type="primary"
                >
                  {t("common.create")}
                </AppButton>
              </PermissionGate>
            </div>
          </div>
        }
      >
        {loadError ? (
          <Alert
            action={
              <AppButton
                onClick={() => {
                  void loadData();
                }}
                type="link"
              >
                {t("common.retry")}
              </AppButton>
            }
            message={loadError}
            showIcon
            style={{ marginBottom: 16 }}
            type="error"
          />
        ) : null}
        <AppTable<StarterRecord>
          columns={columns}
          dataSource={items}
          loading={loading}
          locale={{ emptyText: t("starter.empty") }}
          pagination={{
            current: pageState.page,
            pageSize: pageState.pageSize,
            total,
            onChange: setPagination,
          }}
          rowKey="id"
        />
      </CrudListPage>
      {detailRecord ? (
        <Suspense fallback={<RouteLoading />}>
          <StarterDetailDrawer
            onClose={() => setDetailRecord(null)}
            open={Boolean(detailRecord)}
            record={detailRecord}
            translations={detailTranslations}
          />
        </Suspense>
      ) : null}
    </>
  );
}
