/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ReloadOutlined } from "@ant-design/icons";
import { Alert, Checkbox, DatePicker, Select, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { Dayjs } from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import {
  listAuditLogs,
  listDepartments,
  listRoles,
  listUsers,
} from "@/modules/system-admin/services/admin.service";
import type {
  AdminDepartment,
  AdminRole,
  AdminUser,
  AuditLog,
} from "@/modules/system-admin/types/admin";
import { AUDIT_RESOURCES, auditActionToken } from "@/modules/system-admin/utils/audit-labels";

import styles from "./admin.module.css";

function formatTime(value: string) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .format(date)
    .replace(/\//g, "-");
}

function parseAuditDetail(detail?: string): Record<string, unknown> {
  if (!detail) {
    return {};
  }
  try {
    const parsed = JSON.parse(detail);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

const PAGE_SIZE = 20;

export function AuditLogScene() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [departments, setDepartments] = useState<AdminDepartment[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [resource, setResource] = useState<string>();
  const [actorId, setActorId] = useState<string>();
  const [failedOnly, setFailedOnly] = useState(false);
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  const userName = useMemo(() => {
    const map = new Map(users.map((user) => [user.id, `${user.name}（${user.account}）`]));
    return (id: string) => map.get(id) ?? id;
  }, [users]);

  // 按资源类型把 target_id 解析成名字（已删除对象解析不到 → 回落短 id）。
  const resolveTarget = useMemo(() => {
    const u = new Map(users.map((x) => [x.id, x.name]));
    const d = new Map(departments.map((x) => [x.id, x.name]));
    const r = new Map(roles.map((x) => [x.id, x.name]));
    return (resource: string, id: string): string | undefined => {
      if (resource === "users") {
        return u.get(id);
      }
      if (resource === "departments") {
        return d.get(id);
      }
      if (resource === "roles") {
        return r.get(id);
      }
      return undefined;
    };
  }, [departments, roles, users]);

  const resolveDetailTarget = useCallback(
    (log: AuditLog): string | undefined => {
      const detail = parseAuditDetail(log.detail);
      const directName = stringValue(detail.name);
      if (directName) {
        return directName;
      }
      const roleId = stringValue(detail.role_id);
      const accessorId = stringValue(detail.accessor_id);
      if (log.resource === "role-bindings" && roleId) {
        const roleName = resolveTarget("roles", roleId) ?? roleId;
        const accessorName =
          resolveTarget("users", accessorId) ??
          resolveTarget("departments", accessorId) ??
          accessorId;
        return accessorName ? `${roleName} / ${accessorName}` : roleName;
      }
      const resource = detail.resource;
      if (resource && typeof resource === "object" && !Array.isArray(resource)) {
        const resourceRecord = resource as Record<string, unknown>;
        const resourceType = stringValue(resourceRecord.type);
        const resourceId = stringValue(resourceRecord.id);
        if (resourceType === "users" || resourceType === "departments" || resourceType === "roles") {
          return resolveTarget(resourceType, resourceId) ?? resourceId;
        }
      }
      return undefined;
    },
    [resolveTarget],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await listAuditLogs({
        resource,
        actorId,
        failedOnly,
        from: range?.[0]?.toISOString(),
        to: range?.[1]?.toISOString(),
        offset: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      setLogs(result.logs);
      setTotal(result.total);
    } catch (error) {
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [actorId, failedOnly, page, range, resource]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void listUsers().then(setUsers).catch(() => undefined);
    void listDepartments().then(setDepartments).catch(() => undefined);
    void listRoles().then(setRoles).catch(() => undefined);
  }, []);

  const columns: ColumnsType<AuditLog> = [
    {
      title: t("systemAdmin.audit.columns.time"),
      dataIndex: "createdAt",
      render: (value: string) => <span className={styles.subText}>{formatTime(value)}</span>,
    },
    {
      title: t("systemAdmin.audit.columns.actor"),
      dataIndex: "actorId",
      render: (value: string) => <span className={styles.modeText}>{userName(value)}</span>,
    },
    {
      title: t("systemAdmin.audit.columns.action"),
      key: "action",
      render: (_, log) => {
        const token = auditActionToken(log.method, log.action);
        return (
          <span className={styles.chipRow}>
            <Tag className={styles.roleTag}>{log.method}</Tag>
            <span className={styles.modeText}>
              {token
                ? t(`systemAdmin.audit.act.${token}`)
                : `${log.resource} · ${log.action}`}
            </span>
          </span>
        );
      },
    },
    {
      title: t("systemAdmin.audit.columns.target"),
      key: "target",
      render: (_, log) => {
        const detailName = resolveDetailTarget(log);
        const displayName =
          log.targetName ||
          (log.targetId ? resolveTarget(log.resource, log.targetId) : undefined) ||
          detailName;
        if (!log.targetId) {
          return displayName ? (
            <span className={styles.modeText}>{displayName}</span>
          ) : (
            <span className={styles.mutedText}>—</span>
          );
        }
        if (displayName) {
          return (
            <Tooltip title={log.targetId}>
              <span className={styles.modeText}>{displayName}</span>
            </Tooltip>
          );
        }
        // 解析不到（多为已删除对象）→ 短 id + 完整 id tooltip。
        return (
          <Tooltip title={`${log.targetId} · ${t("systemAdmin.audit.targetUnknown")}`}>
            <span className={styles.slugChip}>{log.targetId.slice(0, 8)}…</span>
          </Tooltip>
        );
      },
    },
    {
      title: t("systemAdmin.audit.columns.status"),
      dataIndex: "status",
      render: (value: number) => (
        <Tag
          className={[
            styles.statusTag,
            value >= 400 ? styles.statusFrozen : styles.statusEnabled,
          ].join(" ")}
        >
          {value}
        </Tag>
      ),
    },
    {
      title: t("systemAdmin.audit.columns.clientIp"),
      dataIndex: "clientIp",
      render: (value: string) => <span className={styles.subText}>{value || "—"}</span>,
    },
  ];

  return (
    <section className={[styles.contentSurface, styles.contentSurfacePlain].join(" ")}>
      <div className={styles.operationBar}>
        <div className={styles.operationPrimary}>
          <div className={styles.toolbarActions}>
            <AppButton
              icon={<ReloadOutlined />}
              onClick={() => {
                setPage(1);
                void load();
              }}
            >
              {t("common.refresh")}
            </AppButton>
          </div>
          <span className={styles.toolbarMeta}>{t("systemAdmin.audit.description")}</span>
        </div>
        <div className={[styles.toolbarFilters, styles.filtersInline].join(" ")}>
          <Select
            allowClear
            className={styles.filterSelect}
            onChange={(value) => {
              setResource(value);
              setPage(1);
            }}
            options={AUDIT_RESOURCES.map((item) => ({
              label: t(`systemAdmin.audit.resources.${item.replace("-", "_")}`),
              value: item,
            }))}
            placeholder={t("systemAdmin.audit.resourceAll")}
            value={resource}
          />
          <Select
            allowClear
            className={styles.filterSelect}
            onChange={(value) => {
              setActorId(value);
              setPage(1);
            }}
            optionFilterProp="label"
            options={users.map((user) => ({ label: `${user.name}（${user.account}）`, value: user.id }))}
            placeholder={t("systemAdmin.audit.actorAll")}
            showSearch
            value={actorId}
          />
          <DatePicker.RangePicker
            onChange={(value) => {
              setRange(value as [Dayjs | null, Dayjs | null] | null);
              setPage(1);
            }}
            showTime
            value={range ?? undefined}
          />
          <Checkbox
            checked={failedOnly}
            onChange={(event) => {
              setFailedOnly(event.target.checked);
              setPage(1);
            }}
          >
            {t("systemAdmin.audit.failedOnly")}
          </Checkbox>
        </div>
      </div>
      <div className={styles.tableSurface}>
        {loadError ? (
          <Alert
            action={
              <AppButton onClick={() => void load()} type="link">
                {t("common.retry")}
              </AppButton>
            }
            message={loadError}
            showIcon
            type="error"
          />
        ) : (
          <AppTable<AuditLog>
            columns={columns}
            dataSource={logs}
            loading={loading}
            locale={{ emptyText: t("systemAdmin.audit.empty") }}
            pagination={{
              current: page,
              pageSize: PAGE_SIZE,
              total,
              showSizeChanger: false,
              onChange: setPage,
            }}
            rowKey="id"
          />
        )}
      </div>
    </section>
  );
}
