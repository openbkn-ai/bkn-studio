/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  AppstoreOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  IdcardOutlined,
  LinkOutlined,
  ToolOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Alert, Empty, Form, Input, Tag } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { DetailMetaPanel } from "@/modules/execution-factory/components/DetailMetaPanel";
import { ExecutionUnitDetailDrawerLayout } from "@/modules/execution-factory/components/execution-unit-detail/ExecutionUnitDetailDrawerLayout";
import { ToolboxMetadataFormFields } from "@/modules/execution-factory/components/ToolboxMetadataFormFields";
import {
  getToolbox,
  getToolboxMarket,
  updateToolbox,
} from "@/modules/execution-factory/services/toolbox.service";
import type {
  ToolboxEditInput,
  ToolboxRecord,
  ToolboxStatus,
} from "@/modules/execution-factory/types/toolbox";
import {
  formatOptionalTimestamp,
  resolveToolboxCategoryLabel,
} from "@/modules/execution-factory/utils/detail-display";
import { formatAuditUserDisplay } from "@/modules/execution-factory/utils/audit-user-display";
import { useAuditUserDirectory } from "@/modules/execution-factory/utils/use-audit-user-directory";
import { useImpexExport } from "@/modules/execution-factory/utils/use-impex-export";

import styles from "./ToolboxDetailDrawer.module.css";

type ToolboxDetailDrawerProps = {
  boxId: string | null;
  initialEditMode?: boolean;
  installedInDomain?: boolean;
  marketMode?: boolean;
  onClose: () => void;
  onMarketInstall?: () => void;
  onUpdated?: () => void;
  onViewTools?: (boxId: string) => void;
  open: boolean;
};

const statusColorMap: Record<ToolboxStatus, string> = {
  published: "green",
  offline: "default",
  unpublish: "blue",
};

function recordToFormValues(record: ToolboxRecord): Partial<ToolboxEditInput> {
  return {
    boxId: record.boxId,
    category: record.categoryType ?? record.categoryName,
    description: record.description,
    metadataType: record.metadataType ?? "openapi",
    name: record.name,
    serviceUrl: record.serviceUrl,
  };
}

export function ToolboxDetailDrawer({
  boxId,
  initialEditMode = false,
  installedInDomain = false,
  marketMode = false,
  onClose,
  onMarketInstall,
  onUpdated,
  onViewTools,
  open,
}: ToolboxDetailDrawerProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [form] = Form.useForm<ToolboxEditInput>();
  const [record, setRecord] = useState<ToolboxRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { exportComponentById, isExporting } = useImpexExport();
  const auditUserDirectory = useAuditUserDirectory();

  const loadRecord = async (targetBoxId: string) => {
    setLoading(true);
    setLoadError(null);
    setRecord(null);

    try {
      const nextRecord = marketMode
        ? await getToolboxMarket(targetBoxId)
        : await getToolbox(targetBoxId);
      setRecord(nextRecord);
      return nextRecord;
    } catch (error) {
      setLoadError(extractRequestErrorMessage(error));
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !boxId) {
      setEditing(false);
      form.resetFields();
      return;
    }

    void loadRecord(boxId);
  }, [boxId, form, marketMode, open]);

  useEffect(() => {
    if (!open || marketMode) {
      setEditing(false);
      return;
    }

    setEditing(initialEditMode);
  }, [boxId, initialEditMode, marketMode, open]);

  useEffect(() => {
    if (!record || !editing) {
      return;
    }

    form.setFieldsValue(recordToFormValues(record));
  }, [editing, form, record]);

  const handleClose = () => {
    setEditing(false);
    form.resetFields();
    onClose();
  };

  const handleCancelEdit = () => {
    setEditing(false);
    form.resetFields();
  };

  const handleSave = async () => {
    if (!record?.boxId || !record.metadataType) {
      return;
    }

    setSubmitting(true);

    try {
      const values = await form.validateFields();
      await updateToolbox({
        ...values,
        boxId: record.boxId,
        metadataType: record.metadataType,
      });
      void message.success(t("common.success"));
      const nextRecord = await loadRecord(record.boxId);
      setEditing(false);
      if (nextRecord) {
        onUpdated?.();
      }
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) {
        return;
      }

      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const drawerTitle = marketMode
    ? t("executionFactory.toolboxMarketDetailTitle")
    : editing
      ? t("executionFactory.toolboxEditTitle")
      : t("executionFactory.toolboxDetailTitle");

  const basicInfoItems = useMemo(() => {
    if (!record) {
      return [];
    }

    return [
      {
        key: "boxId",
        label: t("executionFactory.toolboxId"),
        value: record.boxId,
        icon: <IdcardOutlined />,
        variant: "mono" as const,
        span: "full" as const,
      },
      {
        key: "category",
        label: t("executionFactory.category"),
        value: resolveToolboxCategoryLabel(record, t),
        icon: <AppstoreOutlined />,
        variant: "accent" as const,
      },
      {
        key: "metadataType",
        label: t("executionFactory.metadataType"),
        value: record.metadataType
          ? t(`executionFactory.metadataTypes.${record.metadataType}`)
          : "-",
      },
      {
        key: "toolCount",
        label: t("executionFactory.toolCount"),
        value: String(record.toolCount ?? record.tools?.length ?? 0),
        icon: <ToolOutlined />,
      },
      {
        key: "serviceUrl",
        label: t("executionFactory.serviceUrl"),
        value: record.serviceUrl ?? "-",
        icon: <LinkOutlined />,
        span: "full" as const,
        variant: "mono" as const,
      },
      {
        key: "createUser",
        label: t("executionFactory.createUser"),
        value: formatAuditUserDisplay({ directory: auditUserDirectory, id: record.createUser }),
        icon: <UserOutlined />,
      },
      {
        key: "updateUser",
        label: t("executionFactory.updateUser"),
        value: formatAuditUserDisplay({ directory: auditUserDirectory, id: record.updateUser }),
        icon: <UserOutlined />,
      },
      {
        key: "createTime",
        label: t("executionFactory.createTime"),
        value: formatOptionalTimestamp(record.createTime),
        icon: <CalendarOutlined />,
      },
      {
        key: "updateTime",
        label: t("executionFactory.updateTime"),
        value: formatOptionalTimestamp(record.updateTime),
        icon: <ClockCircleOutlined />,
      },
      {
        key: "releaseUser",
        label: t("executionFactory.releaseUser"),
        value: formatAuditUserDisplay({ directory: auditUserDirectory, id: record.releaseUser }),
        icon: <UserOutlined />,
      },
      {
        key: "releaseTime",
        label: t("executionFactory.releaseTime"),
        value: formatOptionalTimestamp(record.releaseTime),
        icon: <CalendarOutlined />,
      },
    ];
  }, [auditUserDirectory, record, t]);

  return (
    <ExecutionUnitDetailDrawerLayout
      empty={!record}
      footerPrimary={
        editing ? (
          <AppButton loading={submitting} onClick={() => void handleSave()} type="primary">
            {t("common.save")}
          </AppButton>
        ) : marketMode ? (
          onMarketInstall ? (
            <AppButton onClick={onMarketInstall} type="primary">
              {t(
                installedInDomain
                  ? "executionFactory.marketSync"
                  : "executionFactory.marketIntroduce",
              )}
            </AppButton>
          ) : null
        ) : onViewTools && record ? (
          <AppButton onClick={() => onViewTools(record.boxId)} type="primary">
            {t("executionFactory.viewToolsDetail")}
            {` (${record.toolCount ?? record.tools?.length ?? 0})`}
          </AppButton>
        ) : null
      }
      footerSecondary={
        editing ? (
          <AppButton onClick={handleCancelEdit}>{t("common.cancel")}</AppButton>
        ) : !marketMode && record ? (
          <>
            {!record.isInternal ? (
              <PermissionGate permissions="execution-factory:impex:export">
                <AppButton
                  icon={<DownloadOutlined />}
                  loading={isExporting("toolbox", record.boxId)}
                  onClick={() => {
                    void exportComponentById("toolbox", record.boxId, record.name);
                  }}
                >
                  {t("executionFactory.cardMenu.export")}
                </AppButton>
              </PermissionGate>
            ) : null}
            {!record.isInternal ? (
              <PermissionGate permissions="execution-factory:toolbox:edit">
                <AppButton onClick={() => setEditing(true)}>
                  {t("executionFactory.cardMenu.edit")}
                </AppButton>
              </PermissionGate>
            ) : null}
          </>
        ) : null
      }
      loadError={loadError}
      loading={loading}
      marketMode={marketMode}
      onClose={handleClose}
      open={open}
      title={drawerTitle}
    >
      {record ? (
        <div className={styles.drawerContent}>
          <section className={styles.summaryCard}>
            <div className={styles.summaryHeader}>
              <div>
                <h2 className={styles.summaryTitle}>{record.name}</h2>
                <p className={styles.summaryDescription}>{record.description || "-"}</p>
              </div>
              <div className={styles.summaryStatus}>
                <Tag color={statusColorMap[record.status]}>
                  {t(`executionFactory.toolboxStatuses.${record.status}`)}
                </Tag>
                {record.metadataType ? (
                  <Tag>{t(`executionFactory.metadataTypes.${record.metadataType}`)}</Tag>
                ) : null}
                {record.isInternal ? (
                  <Tag>{t("executionFactory.internalTag")}</Tag>
                ) : null}
              </div>
            </div>
          </section>

          {editing ? (
            <section className={styles.sectionCard}>
              <Alert
                message={t("executionFactory.toolboxEditFlowHint")}
                showIcon
                style={{ marginBottom: 16 }}
                type="info"
              />
              <Form form={form} layout="vertical">
                <ToolboxMetadataFormFields />
                <Form.Item label={t("executionFactory.metadataType")}>
                  <Input
                    disabled
                    value={
                      record.metadataType
                        ? t(`executionFactory.metadataTypes.${record.metadataType}`)
                        : "-"
                    }
                  />
                </Form.Item>
                <Form.Item label={t("executionFactory.toolboxId")}>
                  <Input disabled value={record.boxId} />
                </Form.Item>
              </Form>
            </section>
          ) : (
            <DetailMetaPanel
              columns={2}
              compact
              items={basicInfoItems}
              title={t("common.basicInfo")}
            />
          )}

          {!editing ? (
            <section className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>{t("executionFactory.toolsSectionTitle")}</h3>
              {record.tools && record.tools.length > 0 ? (
                <div className={styles.toolList}>
                  {record.tools.map((tool) => (
                    <div className={styles.toolItem} key={tool.toolId}>
                      <div>
                        <div className={styles.toolName}>{tool.name}</div>
                        <div className={styles.toolMeta}>{tool.toolId}</div>
                        {tool.description ? (
                          <div className={styles.toolMeta}>{tool.description}</div>
                        ) : null}
                      </div>
                      <Tag>
                        {tool.status
                          ? t(`executionFactory.toolStatuses.${tool.status}`)
                          : "-"}
                      </Tag>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty description={t("executionFactory.toolsEmpty")} />
              )}
            </section>
          ) : null}
        </div>
      ) : null}
    </ExecutionUnitDetailDrawerLayout>
  );
}
