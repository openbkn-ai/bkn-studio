/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ReloadOutlined } from "@ant-design/icons";
import { Alert, Checkbox, DatePicker, Select, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import { useDebouncedValue } from "@/framework/hooks/use-debounced-value";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { AuditLogDetailDrawer } from "@/modules/system-admin/components/AuditLogDetailDrawer";
import {
  getCachedDepartments,
  getCachedRoles,
  getCachedUser,
  formatAuditTime,
  getCachedUserSync,
  hydrateUserLookup,
  listCachedUsers,
  primeUserLookupCache,
} from "@/modules/system-admin/utils/audit-lookup-cache";
import {
  listAuditLogs,
  listUsersPage,
} from "@/modules/system-admin/services/admin.service";
import type {
  AdminDepartment,
  AdminRole,
  AuditLog,
} from "@/modules/system-admin/types/admin";
import {
  applyAuditLogFilters,
  readAuditLogFilters,
  type AuditLogFilters,
} from "@/modules/system-admin/utils/audit-log-url";
import { AUDIT_RESOURCES, auditActionToken } from "@/modules/system-admin/utils/audit-labels";
import {
  collectAuditUserIds,
  resolveAuditTargetLabel,
} from "@/modules/system-admin/utils/audit-target-label";

import styles from "./admin.module.css";
import layoutStyles from "./UserManagementScene.module.css";

function rangeFromFilters(filters: AuditLogFilters): [Dayjs | null, Dayjs | null] | null {
  if (!filters.from && !filters.to) {
    return null;
  }
  return [filters.from ? dayjs(filters.from) : null, filters.to ? dayjs(filters.to) : null];
}

function userOptionLabel(name: string, account: string) {
  return `${name}（${account}）`;
}

export function AuditLogScene() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlFilters = useMemo(() => readAuditLogFilters(searchParams), [searchParams]);
  const pageState = useMemo(
    () => ({ page: urlFilters.page, pageSize: urlFilters.pageSize }),
    [urlFilters.page, urlFilters.pageSize],
  );

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const tableSectionRef = useRef<HTMLDivElement>(null);
  const [tableScrollY, setTableScrollY] = useState(360);
  const [departments, setDepartments] = useState<AdminDepartment[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [lookupRevision, setLookupRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);

  const [actorKeyword, setActorKeyword] = useState("");
  const debouncedActorKeyword = useDebouncedValue(actorKeyword, 300);
  const [actorOptions, setActorOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [actorSearchLoading, setActorSearchLoading] = useState(false);

  const userName = useMemo(() => {
    void lookupRevision;
    const map = new Map(
      listCachedUsers().map((user) => [user.id, userOptionLabel(user.name, user.account)]),
    );
    return (id: string) => map.get(id) ?? id;
  }, [lookupRevision]);

  const resolveTarget = useMemo(() => {
    void lookupRevision;
    const users = new Map(listCachedUsers().map((item) => [item.id, item.name]));
    const deptMap = new Map(departments.map((item) => [item.id, item.name]));
    const roleMap = new Map(roles.map((item) => [item.id, item.name]));
    return (resource: string, id: string): string | undefined => {
      if (resource === "users") {
        return users.get(id);
      }
      if (resource === "departments") {
        return deptMap.get(id);
      }
      if (resource === "roles") {
        return roleMap.get(id);
      }
      return undefined;
    };
  }, [departments, lookupRevision, roles]);

  const getTargetLabel = useCallback(
    (log: AuditLog) => resolveAuditTargetLabel(log, resolveTarget),
    [resolveTarget],
  );

  const updateUrlFilters = useCallback(
    (patch: Partial<AuditLogFilters>) => {
      const next = applyAuditLogFilters(searchParams, {
        ...urlFilters,
        ...patch,
      });
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams, urlFilters],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await listAuditLogs({
        resource: urlFilters.resource,
        actorId: urlFilters.actorId,
        targetId: urlFilters.targetId,
        failedOnly: urlFilters.failedOnly,
        from: urlFilters.from,
        to: urlFilters.to,
        offset: (pageState.page - 1) * pageState.pageSize,
        limit: pageState.pageSize,
      });
      setLogs(result.logs);
      setTotal(result.total);
    } catch (error) {
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [pageState.page, pageState.pageSize, urlFilters]);

  const setPagination = useCallback(
    (nextPage: number, nextPageSize: number) => {
      updateUrlFilters({ page: nextPage, pageSize: nextPageSize });
    },
    [updateUrlFilters],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void Promise.all([getCachedDepartments(), getCachedRoles()])
      .then(([nextDepartments, nextRoles]) => {
        setDepartments(nextDepartments);
        setRoles(nextRoles);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!logs.length) {
      return;
    }
    const ids = collectAuditUserIds(logs);
    void hydrateUserLookup(ids).then(() => {
      setLookupRevision((value) => value + 1);
    });
  }, [logs]);

  useEffect(() => {
    if (!urlFilters.actorId) {
      return;
    }
    void getCachedUser(urlFilters.actorId).then((user) => {
      if (!user) {
        return;
      }
      primeUserLookupCache([user]);
      setActorOptions((current) => {
        if (current.some((item) => item.value === user.id)) {
          return current;
        }
        return [
          { label: userOptionLabel(user.name, user.account), value: user.id },
          ...current,
        ];
      });
      setLookupRevision((value) => value + 1);
    });
  }, [urlFilters.actorId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setActorSearchLoading(true);
      try {
        const result = await listUsersPage({
          limit: 20,
          offset: 0,
          search: debouncedActorKeyword,
        });
        if (cancelled) {
          return;
        }
        primeUserLookupCache(result.users);
        const options = result.users.map((user) => ({
          label: userOptionLabel(user.name, user.account),
          value: user.id,
        }));
        const selectedUser = urlFilters.actorId ? getCachedUserSync(urlFilters.actorId) : undefined;
        if (
          selectedUser &&
          !options.some((item) => item.value === selectedUser.id)
        ) {
          options.unshift({
            label: userOptionLabel(selectedUser.name, selectedUser.account),
            value: selectedUser.id,
          });
        }
        setActorOptions(options);
        setLookupRevision((value) => value + 1);
      } catch {
        if (!cancelled) {
          setActorOptions([]);
        }
      } finally {
        if (!cancelled) {
          setActorSearchLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedActorKeyword, urlFilters.actorId]);

  useLayoutEffect(() => {
    const element = tableSectionRef.current;
    if (!element) {
      return;
    }
    const updateHeight = () => {
      setTableScrollY(Math.max(240, element.clientHeight - 4));
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const hasActiveFilters =
    Boolean(urlFilters.resource) ||
    Boolean(urlFilters.actorId) ||
    Boolean(urlFilters.targetId) ||
    urlFilters.failedOnly ||
    Boolean(urlFilters.from) ||
    Boolean(urlFilters.to);

  const columns: ColumnsType<AuditLog> = useMemo(
    () => [
      {
        title: t("systemAdmin.audit.columns.action"),
        ellipsis: true,
        key: "action",
        width: 248,
        render: (_, log) => {
          const token = auditActionToken(log.method, log.action);
          const label = token
            ? t(`systemAdmin.audit.act.${token}`)
            : `${log.resource} · ${log.action}`;
          return (
            <Tooltip title={`${log.method} ${label}`}>
              <span className={styles.auditActionChip}>
                <Tag className={styles.roleTag}>{log.method}</Tag>
                <span className={[styles.modeText, layoutStyles.ellipsisCell].join(" ")}>{label}</span>
              </span>
            </Tooltip>
          );
        },
      },
      {
        title: t("systemAdmin.audit.columns.target"),
        ellipsis: true,
        key: "target",
        minWidth: 200,
        render: (_, log) => {
          const displayName = getTargetLabel(log);
          if (!log.targetId) {
            return displayName ? (
              <span className={[styles.modeText, layoutStyles.ellipsisCell].join(" ")}>{displayName}</span>
            ) : (
              <span className={styles.mutedText}>—</span>
            );
          }
          if (displayName) {
            return (
              <Tooltip title={log.targetId}>
                <span className={[styles.modeText, layoutStyles.ellipsisCell].join(" ")}>{displayName}</span>
              </Tooltip>
            );
          }
          return (
            <Tooltip title={`${log.targetId} · ${t("systemAdmin.audit.targetUnknown")}`}>
              <span className={styles.slugChip}>{log.targetId.slice(0, 8)}…</span>
            </Tooltip>
          );
        },
      },
      {
        title: t("systemAdmin.audit.columns.actor"),
        dataIndex: "actorId",
        ellipsis: true,
        width: 168,
        render: (value: string) => (
          <Tooltip title={userName(value)}>
            <span className={[styles.modeText, layoutStyles.ellipsisCell].join(" ")}>
              {userName(value)}
            </span>
          </Tooltip>
        ),
      },
      {
        title: t("systemAdmin.audit.columns.status"),
        align: "center",
        dataIndex: "status",
        width: 72,
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
        title: t("systemAdmin.audit.columns.time"),
        dataIndex: "createdAt",
        width: 176,
        render: (value: string) => (
          <span className={styles.subText}>{formatAuditTime(value, i18n.language)}</span>
        ),
      },
      {
        title: t("systemAdmin.audit.columns.clientIp"),
        dataIndex: "clientIp",
        ellipsis: true,
        width: 128,
        render: (value: string) => (
          <Tooltip title={value || undefined}>
            <span className={[styles.subText, layoutStyles.ellipsisCell].join(" ")}>{value || "—"}</span>
          </Tooltip>
        ),
      },
      {
        title: t("systemAdmin.audit.columns.detail"),
        align: "center",
        fixed: "right",
        key: "detail",
        width: 80,
        render: (_, log) => (
          <AppButton onClick={() => setDetailLog(log)} type="link">
            {t("systemAdmin.audit.viewDetail")}
          </AppButton>
        ),
      },
    ],
    [getTargetLabel, i18n.language, t, userName],
  );

  return (
    <>
      <section className={[styles.contentSurface, layoutStyles.pageSurface].join(" ")}>
        <div className={layoutStyles.explorer}>
          <aside className={layoutStyles.deptPanel}>
            <div className={layoutStyles.deptPanelHead}>
              <h2 className={layoutStyles.deptPanelTitle}>{t("systemAdmin.audit.title")}</h2>
              <span className={styles.toolbarMeta}>{t("systemAdmin.audit.description")}</span>
            </div>
            <Select
              allowClear
              className={styles.filterSelect}
              onChange={(value) => {
                updateUrlFilters({ resource: value, page: 1 });
              }}
              options={AUDIT_RESOURCES.map((item) => ({
                label: t(`systemAdmin.audit.resources.${item.replace("-", "_")}`),
                value: item,
              }))}
              placeholder={t("systemAdmin.audit.resourceAll")}
              style={{ width: "100%" }}
              value={urlFilters.resource}
            />
            <Select
              allowClear
              className={styles.filterSelect}
              filterOption={false}
              loading={actorSearchLoading}
              onChange={(value) => {
                updateUrlFilters({ actorId: value, page: 1 });
              }}
              onSearch={setActorKeyword}
              options={actorOptions}
              placeholder={t("systemAdmin.audit.actorAll")}
              showSearch
              style={{ width: "100%" }}
              value={urlFilters.actorId}
            />
            <DatePicker.RangePicker
              onChange={(value) => {
                const range = value;
                updateUrlFilters({
                  from: range?.[0]?.toISOString(),
                  page: 1,
                  to: range?.[1]?.toISOString(),
                });
              }}
              showTime
              style={{ width: "100%" }}
              value={rangeFromFilters(urlFilters) ?? undefined}
            />
            <Tooltip title={t("systemAdmin.audit.failedOnlyHint")}>
              <Checkbox
                checked={urlFilters.failedOnly}
                onChange={(event) => {
                  updateUrlFilters({ failedOnly: event.target.checked, page: 1 });
                }}
              >
                {t("systemAdmin.audit.failedOnly")}
              </Checkbox>
            </Tooltip>
            {hasActiveFilters ? (
              <AppButton
                onClick={() => {
                  setSearchParams(new URLSearchParams(), { replace: true });
                }}
                type="link"
              >
                {t("systemAdmin.audit.clearFilters")}
              </AppButton>
            ) : null}
          </aside>

          <div className={layoutStyles.userPanel}>
            <div className={layoutStyles.userPanelHead}>
              <div className={layoutStyles.userPanelToolbar}>
                <div className={layoutStyles.userPanelLeading}>
                  <div className={styles.toolbarActions}>
                    <AppButton icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>
                      {t("common.refresh")}
                    </AppButton>
                  </div>
                </div>
              </div>
            </div>

            {urlFilters.targetId ? (
              <Alert
                className={styles.inlineAlert}
                message={t("systemAdmin.audit.targetFilterActive", { id: urlFilters.targetId })}
                showIcon
                type="info"
              />
            ) : null}

            <div className={layoutStyles.tableSection} ref={tableSectionRef}>
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
                  pagination={false}
                  rowKey="id"
                  scroll={{ x: 1072, y: tableScrollY }}
                />
              )}
            </div>
            {total > 0 ? (
              <TablePaginationBar
                current={pageState.page}
                onChange={setPagination}
                pageSize={pageState.pageSize}
                pageSizeOptions={[10, 20, 50]}
                showSizeChanger
                showTotal={(count) => t("common.total", { total: count })}
                total={total}
              />
            ) : null}
          </div>
        </div>
      </section>

      <AuditLogDetailDrawer
        actorLabel={userName}
        log={detailLog}
        onClose={() => setDetailLog(null)}
        open={Boolean(detailLog)}
        targetLabel={getTargetLabel}
      />
    </>
  );
}
