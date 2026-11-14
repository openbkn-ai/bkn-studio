/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { EllipsisOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  Alert,
  Descriptions,
  Dropdown,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  type MenuProps,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { formatDateTimeYmdHms } from "@/framework/i18n/format";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { TableSurface } from "@/framework/ui/common/TableSurface";
import { canManageResourceBuildTasks } from "@/modules/data-catalog/lib/resource-index-access";
import { BuildScheduleFormModal } from "@/modules/data-catalog/components/BuildScheduleFormModal";
import {
  createBuildSchedule,
  deleteBuildSchedule,
  getBuildSchedule,
  listBuildSchedulePage,
  setBuildScheduleEnabled,
  updateBuildSchedule,
} from "@/modules/data-catalog/services/build-schedule.service";
import type {
  BuildSchedule,
  BuildScheduleInput,
} from "@/modules/data-catalog/types/build-schedule";
import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";
import type { CatalogRecord } from "@/shared/catalog";
import { ScheduleRunResultView } from "@/shared/schedule";

import styles from "./BuildSchedulePanel.module.css";

type BuildSchedulePanelProps = {
  active?: boolean;
  resource: CatalogResource;
  catalog?: CatalogRecord | null;
};

export function BuildSchedulePanel({ active = true, resource, catalog }: BuildSchedulePanelProps) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const navigate = useNavigate();
  const [rows, setRows] = useState<BuildSchedule[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [name, setName] = useState("");
  const [enabled, setEnabled] = useState<boolean>();
  const [executeType, setExecuteType] = useState<"full" | "incremental">();
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<BuildSchedule>();
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [details, setDetails] = useState<BuildSchedule>();
  const requestIdRef = useRef(0);
  const actionRequestRef = useRef(0);
  const allowedToCreate =
    resource.category === "table" && canManageResourceBuildTasks(resource, catalog ?? null);

  useEffect(() => {
    actionRequestRef.current += 1;
    setPage(1);
    setEditing(undefined);
    setFormOpen(false);
    setDetails(undefined);
    setActionError(null);
    setRows([]);
    setTotal(0);
    setBusyId(null);
    setSubmitting(false);
    return () => {
      actionRequestRef.current += 1;
    };
  }, [active, resource.id]);

  useEffect(() => {
    if (!active) return;
    const requestId = ++requestIdRef.current;
    let cancelled = false;
    const current = () => !cancelled && requestIdRef.current === requestId;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        const result = await listBuildSchedulePage(
          {
            page,
            pageSize,
            name,
            resourceId: resource.id,
            enabled,
            executeType,
            sort: "update_time",
            direction: "desc",
          },
          { skipErrorToast: true },
        );
        if (!current()) return;
        setRows(result.items);
        setTotal(result.total);
        if (result.items.length === 0 && page > 1) setPage(page - 1);
      } catch (cause) {
        if (!current()) return;
        setRows([]);
        setTotal(0);
        setLoadError(extractRequestErrorMessage(cause));
      } finally {
        if (current()) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, enabled, executeType, name, page, pageSize, resource.id, revision]);

  const refresh = () => setRevision((value) => value + 1);
  const canManage = (row: BuildSchedule) => row.resourceId === resource.id && allowedToCreate;
  const loadDetail = async (row: BuildSchedule, edit: boolean) => {
    if (row.resourceId !== resource.id) return;
    const requestId = ++actionRequestRef.current;
    setBusyId(row.id);
    setActionError(null);
    try {
      const latest = await getBuildSchedule(row.id, { skipErrorToast: true });
      if (requestId !== actionRequestRef.current) return;
      if (edit) {
        setEditing(latest);
        setFormOpen(true);
      } else setDetails(latest);
    } catch (cause) {
      if (requestId === actionRequestRef.current) setActionError(extractRequestErrorMessage(cause));
    } finally {
      if (requestId === actionRequestRef.current) setBusyId(null);
    }
  };
  const toggle = async (row: BuildSchedule, next: boolean) => {
    const requestId = ++actionRequestRef.current;
    setBusyId(row.id);
    setActionError(null);
    try {
      await setBuildScheduleEnabled(row.id, next, { skipErrorToast: true });
      if (requestId !== actionRequestRef.current) return;
      refresh();
    } catch (cause) {
      if (requestId === actionRequestRef.current) setActionError(extractRequestErrorMessage(cause));
    } finally {
      if (requestId === actionRequestRef.current) setBusyId(null);
    }
  };
  const remove = (row: BuildSchedule) => {
    const requestId = actionRequestRef.current;
    void modal.confirm({
      title: t("dataCatalog.buildSchedule.deleteTitle", { name: row.name }),
      content: t("dataCatalog.buildSchedule.deleteHint"),
      okText: t("common.delete"),
      okButtonProps: { danger: true },
      onOk: async () => {
        if (requestId !== actionRequestRef.current) return;
        setBusyId(row.id);
        try {
          await deleteBuildSchedule(row.id, { skipErrorToast: true });
          if (requestId === actionRequestRef.current) refresh();
        } catch (cause) {
          if (requestId === actionRequestRef.current)
            setActionError(extractRequestErrorMessage(cause));
          throw cause;
        } finally {
          if (requestId === actionRequestRef.current) setBusyId(null);
        }
      },
    });
  };
  const save = async (input: BuildScheduleInput) => {
    const requestId = actionRequestRef.current;
    setSubmitting(true);
    setActionError(null);
    try {
      if (editing)
        await updateBuildSchedule(editing.id, input, editing.updateTime, { skipErrorToast: true });
      else await createBuildSchedule(input, { skipErrorToast: true });
      if (requestId !== actionRequestRef.current) return;
      setFormOpen(false);
      refresh();
      void message.success(t("dataCatalog.buildSchedule.saved"));
    } catch (cause) {
      if (requestId === actionRequestRef.current) setActionError(extractRequestErrorMessage(cause));
    } finally {
      if (requestId === actionRequestRef.current) setSubmitting(false);
    }
  };

  const columns: ColumnsType<BuildSchedule> = [
    {
      title: t("dataCatalog.buildSchedule.name"),
      dataIndex: "name",
      width: 180,
      render: (value: string, row) => (
        <AppButton
          disabled={busyId !== null}
          onClick={() => void loadDetail(row, false)}
          type="link"
        >
          {value}
        </AppButton>
      ),
    },
    { title: t("dataCatalog.buildSchedule.cron"), dataIndex: "cronExpr", width: 160 },
    {
      title: t("dataCatalog.buildSchedule.executeType"),
      dataIndex: "executeType",
      width: 110,
      render: (value: string) =>
        t(
          value === "incremental"
            ? "dataCatalog.build.executeIncremental"
            : "dataCatalog.build.executeFull",
        ),
    },
    {
      title: t("dataCatalog.buildSchedule.enabled"),
      dataIndex: "enabled",
      width: 90,
      render: (value: boolean, row) => (
        <Switch
          aria-label={t("dataCatalog.buildSchedule.toggle", { name: row.name })}
          checked={value}
          disabled={!canManage(row) || busyId !== null}
          loading={busyId === row.id}
          onChange={(next) => void toggle(row, next)}
        />
      ),
    },
    {
      title: t("dataCatalog.buildSchedule.lastResult"),
      key: "lastResult",
      width: 280,
      render: (_, row) => (
        <ScheduleRunResultView status={row.lastStatus} message={row.lastMessage} />
      ),
    },
    {
      title: t("dataCatalog.buildSchedule.lastRun"),
      dataIndex: "lastRun",
      width: 170,
      render: (value: number) => formatDateTimeYmdHms(value || undefined),
    },
    {
      title: t("dataCatalog.buildSchedule.nextRun"),
      dataIndex: "nextRun",
      width: 170,
      render: (value: number) => formatDateTimeYmdHms(value || undefined),
    },
    {
      title: t("common.actions"),
      key: "actions",
      align: "center",
      width: 84,
      fixed: "right",
      render: (_, row) => {
        const items: NonNullable<MenuProps["items"]> = [
          { key: "detail", label: t("common.detail") },
        ];
        if (canManage(row)) items.push({ key: "edit", label: t("common.edit") });
        items.push({ key: "tasks", label: t("dataCatalog.buildSchedule.tasks") });
        if (canManage(row)) items.push({ key: "delete", label: t("common.delete"), danger: true });
        return (
          <Dropdown
            disabled={busyId !== null}
            menu={{
              items,
              onClick: ({ key, domEvent }) => {
                domEvent.stopPropagation();
                if (key === "detail") void loadDetail(row, false);
                if (key === "edit") void loadDetail(row, true);
                if (key === "tasks")
                  void navigate(
                    `/task-management?tab=index-build&schedule_id=${encodeURIComponent(row.id)}`,
                  );
                if (key === "delete") remove(row);
              },
            }}
            trigger={["click"]}
          >
            <AppButton
              aria-label={t("dataCatalog.actions.more")}
              className={styles.actionMore}
              disabled={busyId !== null}
              icon={<EllipsisOutlined />}
              type="link"
            />
          </Dropdown>
        );
      },
    },
  ];

  return (
    <div className={styles.panel}>
      <Alert message={t("dataCatalog.buildSchedule.hint")} showIcon type="info" />
      <Space wrap>
        <Input.Search
          allowClear
          aria-label={t("dataCatalog.buildSchedule.name")}
          onSearch={(value) => {
            setName(value.trim());
            setPage(1);
          }}
          placeholder={t("dataCatalog.buildSchedule.search")}
        />
        <Select
          allowClear
          aria-label={t("dataCatalog.buildSchedule.enabledFilter")}
          onChange={(value: boolean | undefined) => {
            setEnabled(value);
            setPage(1);
          }}
          options={[
            { label: t("dataCatalog.buildSchedule.enabled"), value: true },
            { label: t("dataCatalog.buildSchedule.disabled"), value: false },
          ]}
          placeholder={t("dataCatalog.buildSchedule.enabledFilter")}
          value={enabled}
          style={{ minWidth: 120 }}
        />
        <Select
          allowClear
          aria-label={t("dataCatalog.buildSchedule.executeType")}
          onChange={(value: "full" | "incremental" | undefined) => {
            setExecuteType(value);
            setPage(1);
          }}
          options={[
            { label: t("dataCatalog.build.executeFull"), value: "full" },
            { label: t("dataCatalog.build.executeIncremental"), value: "incremental" },
          ]}
          placeholder={t("dataCatalog.buildSchedule.executeType")}
          value={executeType}
          style={{ minWidth: 140 }}
        />
        <AppButton icon={<ReloadOutlined />} onClick={refresh}>
          {t("common.refresh")}
        </AppButton>
        {allowedToCreate ? (
          <AppButton
            disabled={busyId !== null}
            icon={<PlusOutlined />}
            onClick={() => {
              actionRequestRef.current += 1;
              setEditing(undefined);
              setActionError(null);
              setFormOpen(true);
            }}
            type="primary"
          >
            {t("dataCatalog.buildSchedule.create")}
          </AppButton>
        ) : null}
      </Space>
      {!formOpen && actionError ? <Alert message={actionError} showIcon type="error" /> : null}
      <TableSurface>
        {loadError ? (
          <Alert message={loadError} showIcon type="error" />
        ) : (
          <AppTable<BuildSchedule>
            columns={columns}
            dataSource={rows}
            loading={loading}
            pagination={false}
            rowKey="id"
            scroll={{ x: 1280 }}
          />
        )}
      </TableSurface>
      <TablePaginationBar
        current={page}
        pageSize={pageSize}
        total={total}
        showSizeChanger
        onChange={(next, size) => {
          setPage(size === pageSize ? next : 1);
          setPageSize(size);
        }}
      />
      <BuildScheduleFormModal
        error={actionError}
        initialValue={editing}
        onCancel={() => {
          actionRequestRef.current += 1;
          setFormOpen(false);
          setActionError(null);
        }}
        onSubmit={save}
        open={formOpen}
        resource={resource}
        submitting={submitting}
      />
      <Modal
        footer={null}
        onCancel={() => setDetails(undefined)}
        open={Boolean(details)}
        title={details?.name}
        width={640}
      >
        {details ? (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="ID">{details.id}</Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.taskManagement.columns.resource")}>
              {details.resourceId}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.buildSchedule.cron")}>
              {details.cronExpr}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.buildSchedule.executeType")}>
              {t(
                details.executeType === "incremental"
                  ? "dataCatalog.build.executeIncremental"
                  : "dataCatalog.build.executeFull",
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.buildSchedule.startTime")}>
              {formatDateTimeYmdHms(details.startTime || undefined)}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.buildSchedule.endTime")}>
              {formatDateTimeYmdHms(details.endTime || undefined)}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.buildSchedule.lastRun")}>
              {formatDateTimeYmdHms(details.lastRun || undefined)}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.buildSchedule.nextRun")}>
              {formatDateTimeYmdHms(details.nextRun || undefined)}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.buildSchedule.lastResult")}>
              <ScheduleRunResultView status={details.lastStatus} message={details.lastMessage} />
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
    </div>
  );
}
