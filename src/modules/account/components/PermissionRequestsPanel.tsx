/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ApiOutlined,
  ApartmentOutlined,
  AppstoreOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  FileTextOutlined,
  LineChartOutlined,
  ShareAltOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import {
  Alert,
  AutoComplete,
  Avatar,
  Button,
  Divider,
  Drawer,
  Input,
  Popconfirm,
  Select,
  Table,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
} from "antd";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import {
  isRequestConflict,
  isRequestForbidden,
  isRequestNotFound,
} from "@/framework/request/error-message";
import {
  cancelPermissionRequest,
  decidePermissionRequest,
  getPermissionRequest,
  listPermissionRequestReviews,
  listPermissionRequests,
  notifyPermissionRequestTodoSummaryChanged,
  type PermissionRequest,
  type PermissionRequestFilters,
  type PermissionRequestReview,
} from "@/modules/account/services/permission-requests.service";
import {
  checkPermissionRequestResource,
  type PermissionRequestResourceCheck,
} from "@/modules/account/services/permission-request-resource.service";

import styles from "./PermissionRequestsPanel.module.css";

type Tab = "mine" | "todo" | "reviewed";
type ResourceCheckState = {
  id: string;
  result: PermissionRequestResourceCheck | "checking";
};
type RequestFilter = PermissionRequestFilters;
const pageSize = 10;

function truncatedText(content: ReactNode, title: string, lines = 1) {
  return (
    <Tooltip title={title} mouseEnterDelay={0.4}>
      <span
        style={{
          display: "-webkit-box",
          overflow: "hidden",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: lines,
        }}
      >
        {content}
      </span>
    </Tooltip>
  );
}

function avatarInitial(name?: string) {
  return name?.trim().slice(0, 1).toUpperCase() || "?";
}

function resourceIcon(resourceType: string) {
  if (resourceType === "knowledge_network") return <DeploymentUnitOutlined />;
  if (resourceType === "concept_group") return <AppstoreOutlined />;
  if (resourceType === "object_type") return <ApartmentOutlined />;
  if (resourceType === "relation_type") return <ShareAltOutlined />;
  if (resourceType === "action_type") return <ThunderboltOutlined />;
  if (resourceType === "metric") return <LineChartOutlined />;
  if (["catalog", "resource"].includes(resourceType)) return <DatabaseOutlined />;
  if (["tool_box", "function"].includes(resourceType)) return <ToolOutlined />;
  if (resourceType === "mcp") return <ApiOutlined />;
  if (resourceType === "skill") return <FileTextOutlined />;
  return <AppstoreOutlined />;
}

function resourceDetailPath(request: PermissionRequest) {
  const encodedID = encodeURIComponent(request.resource_id);
  if (request.resource_type === "knowledge_network")
    return `knowledge-network/workspace/${encodedID}/overview`;
  if (
    ["concept_group", "object_type", "relation_type", "action_type", "metric"].includes(
      request.resource_type,
    )
  ) {
    const [networkID, childID] = request.resource_id.split("/", 2);
    const segment: Record<string, string> = {
      concept_group: "concept-groups",
      object_type: "object-types",
      relation_type: "relation-types",
      action_type: "action-types",
      metric: "metrics",
    };
    if (networkID && childID)
      return `knowledge-network/workspace/${encodeURIComponent(networkID)}/${segment[request.resource_type]}/${encodeURIComponent(childID)}/detail`;
  }
  if (request.resource_type === "catalog") return `data-catalog/catalog/${encodedID}`;
  if (request.resource_type === "resource") return `data-catalog/resource/${encodedID}`;
  if (request.resource_type === "tool_box") return `execution-factory/toolboxes/${encodedID}/edit`;
  if (request.resource_type === "mcp") return `execution-factory/mcp/${encodedID}`;
  if (request.resource_type === "skill") return `execution-factory/skills/${encodedID}`;
  return undefined;
}

export function PermissionRequestsPanel({ hideMine = false }: { hideMine?: boolean }) {
  const { message } = useAppServices();
  const { i18n, t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => {
    const requestedTab = searchParams.get("tab");
    if (requestedTab === "mine" && !hideMine) return "mine";
    if (requestedTab === "reviewed") return "reviewed";
    return "todo";
  });
  const [rows, setRows] = useState<PermissionRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const offsetRef = useRef(offset);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<PermissionRequest | null>(null);
  const [reviews, setReviews] = useState<PermissionRequestReview[]>([]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [filters, setFilters] = useState<Record<Tab, RequestFilter>>({
    mine: {},
    todo: {},
    reviewed: {},
  });
  const filtersRef = useRef(filters);
  const [searchInputs, setSearchInputs] = useState<Record<Tab, string>>({
    mine: "",
    todo: "",
    reviewed: "",
  });
  const [searchScopes, setSearchScopes] = useState<Record<Tab, "resourceName" | "requester">>({
    mine: "resourceName",
    todo: "resourceName",
    reviewed: "resourceName",
  });
  const searchTimerRef = useRef<number | undefined>(undefined);
  const listRequestRef = useRef(0);
  const listLoadingRef = useRef(false);
  const [resourceCheck, setResourceCheck] = useState<ResourceCheckState | null>(null);
  const submittingRef = useRef(false);
  const resourceCheckRef = useRef<string | null>(null);

  const requestOperationNames = (request: PermissionRequest) =>
    (request.operations?.length ? request.operations : [request.operation]).map((operation) => ({
      id: operation,
      name: t(`account.permissionRequests.operationNames.${operation}`, {
        defaultValue: operation,
      }),
    }));
  const requestOperations = (request: PermissionRequest) =>
    requestOperationNames(request)
      .map(({ name }) => name)
      .join(t("account.permissionRequests.operationSeparator"));
  const resourceName = (request: PermissionRequest) =>
    request.resource_name || `${request.resource_type}:${request.resource_id}`;
  const requestContentText = (request: PermissionRequest) =>
    t("account.permissionRequests.contentTextValue", {
      resource: resourceName(request),
      operations: requestOperations(request),
    });
  const requestType = (request: PermissionRequest) =>
    t(`account.permissionRequests.resourceTypes.${request.resource_type}`, {
      defaultValue: t("account.permissionRequests.resourcePermission"),
    });
  const requestStatus = (status: string) =>
    t(`account.permissionRequests.statuses.${status}`, { defaultValue: status });
  const reviewDecision = (decision: string) =>
    t(`account.permissionRequests.decisions.${decision}`, { defaultValue: decision });
  const requestStatusColor = (status: string) => {
    if (status === "granted") return "success";
    if (status === "rejected" || status === "resource_deleted" || status === "invalidated")
      return "error";
    if (status === "pending") return "processing";
    if (status === "no_reviewer") return "warning";
    return undefined;
  };
  const statusSealClass = (status: string) => {
    if (status === "granted") return styles.statusGranted;
    if (status === "rejected" || status === "resource_deleted" || status === "invalidated")
      return styles.statusRejected;
    if (status === "pending") return styles.statusPending;
    return styles.statusDefault;
  };
  const reviewActorName = (review: PermissionRequestReview) =>
    review.reviewer_name ||
    (detail?.reviewer_id === review.reviewer_id ? detail.reviewer_name : "-");
  const reviewerDisplayName = (request: PermissionRequest) => {
    if (request.reviewer_name) return request.reviewer_name;
    return request.status === "pending"
      ? t("account.permissionRequests.pendingEligibleReviewer")
      : "-";
  };
  const verifyResource = async (request: PermissionRequest) => {
    if (resourceCheckRef.current !== request.id) return;
    setResourceCheck({ id: request.id, result: "checking" });
    const result =
      request.status === "resource_deleted"
        ? "not_found"
        : await checkPermissionRequestResource(request);
    if (resourceCheckRef.current === request.id) setResourceCheck({ id: request.id, result });
  };
  const openResourceDetail = (request: PermissionRequest) => {
    const path = resourceDetailPath(request);
    if (resourceCheck?.id !== request.id || resourceCheck.result !== "exists" || !path) return;
    window.open(`${import.meta.env.BASE_URL}${path}`, "_blank", "noopener,noreferrer");
  };
  const requestContent = (request: PermissionRequest) => (
    <div className={styles.requestContent}>
      <div className={styles.requestContentRow}>
        <span className={styles.resourceIcon}>{resourceIcon(request.resource_type)}</span>
        <span className={styles.requestContentLabel}>
          {t("account.permissionRequests.resource")}：
        </span>
        <span className={styles.resourcePill}>{resourceName(request)}</span>
      </div>
      <div className={styles.requestContentRow}>
        <span className={styles.requestContentLabel}>
          {t("account.permissionRequests.operations")}
        </span>
        <span className={styles.operationList}>
          {requestOperationNames(request).map(({ id, name }) => (
            <Tag
              color={
                ["delete", "authorize", "full_business_access"].includes(id) ? "volcano" : "blue"
              }
              key={id}
            >
              {name}
            </Tag>
          ))}
        </span>
      </div>
    </div>
  );
  const resourceDetailsAction = (request: PermissionRequest) => {
    const result = resourceCheck?.id === request.id ? resourceCheck.result : "checking";
    if (result === "checking")
      return (
        <span className={styles.resourceCheckPending}>
          {t("account.permissionRequests.resourceChecking")}
        </span>
      );
    if (result === "exists")
      return (
        <Button
          className={styles.detailLink}
          onClick={() => openResourceDetail(request)}
          type="link"
        >
          {t("account.permissionRequests.viewResourceDetails")}
        </Button>
      );
    const messageKey =
      result === "not_found"
        ? "account.permissionRequests.resourceDeletedNotice"
        : result === "forbidden"
          ? "account.permissionRequests.resourceDetailsForbidden"
          : result === "unsupported"
            ? "account.permissionRequests.resourceDetailsUnavailable"
            : "account.permissionRequests.resourceCheckFailed";
    return <span className={styles.resourceCheckUnavailable}>{t(messageKey)}</span>;
  };
  const formatRequestTime = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "medium" }).format(
          date,
        );
  };
  const load = useCallback(
    async (next: Tab, nextOffset: number, nextFilters = filtersRef.current[next]) => {
      const requestNumber = ++listRequestRef.current;
      listLoadingRef.current = true;
      setLoading(true);
      try {
        const page = await listPermissionRequests(next, pageSize, nextOffset, nextFilters);
        if (requestNumber !== listRequestRef.current) return;
        setRows(page.entries);
        setTotal(page.total_count);
      } catch {
        if (requestNumber === listRequestRef.current)
          message.error(t("account.permissionRequests.loadFailed"));
      } finally {
        if (requestNumber === listRequestRef.current) {
          listLoadingRef.current = false;
          setLoading(false);
        }
      }
    },
    [message, t],
  );

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    setOffset(0);
    void load(tab, 0);

    // Only a pending todo can change without a local action.  Avoid polling
    // immutable history tabs, background browser tabs, or while a prior list
    // request is still in flight.
    if (tab !== "todo") return;
    const refreshTodo = () => {
      if (document.visibilityState !== "visible" || listLoadingRef.current) return;
      void load(tab, offsetRef.current);
    };
    const timer = window.setInterval(refreshTodo, 30000);
    document.addEventListener("visibilitychange", refreshTodo);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshTodo);
    };
  }, [load, tab]);

  const openDetail = async (id: string) => {
    if (submittingRef.current) return;
    setComment("");
    resourceCheckRef.current = id;
    setResourceCheck({ id, result: "checking" });
    try {
      const [request, nextReviews] = await Promise.all([
        getPermissionRequest(id),
        listPermissionRequestReviews(id),
      ]);
      setDetail(request);
      setReviews(nextReviews);
      void verifyResource(request);
    } catch {
      message.error(t("account.permissionRequests.detailsFailed"));
    }
  };
  const closeDetail = () => {
    if (submittingRef.current) return;
    setComment("");
    setReviews([]);
    resourceCheckRef.current = null;
    setResourceCheck(null);
    setDetail(null);
  };
  const mutationError = (error: unknown) => {
    if (isRequestConflict(error)) return "account.permissionRequests.requestChanged";
    if (isRequestForbidden(error)) return "account.permissionRequests.reviewForbidden";
    if (isRequestNotFound(error)) return "account.permissionRequests.requestNotFound";
    return "account.permissionRequests.decisionFailed";
  };
  const reloadAfterDecision = async () => {
    const nextOffset = rows.length === 1 && offset > 0 ? offset - pageSize : offset;
    if (nextOffset !== offset) setOffset(nextOffset);
    await load(tab, nextOffset);
  };
  const decide = async (id: string, decision: "approve" | "reject", reviewComment = "") => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = await decidePermissionRequest(id, decision, reviewComment);
      setComment("");
      if (result.status === "invalidated") {
        message.warning(t("account.permissionRequests.approvalInvalidated"));
      } else {
        message.success(
          t(
            decision === "approve"
              ? "account.permissionRequests.approveSuccess"
              : "account.permissionRequests.rejectSuccess",
          ),
        );
      }
      const [nextDetail, nextReviews] = await Promise.all([
        getPermissionRequest(id),
        listPermissionRequestReviews(id),
      ]);
      setDetail(nextDetail);
      setReviews(nextReviews);
      await reloadAfterDecision();
      notifyPermissionRequestTodoSummaryChanged();
    } catch (error) {
      message.error(t(mutationError(error)));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };
  const cancel = async (id: string) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await cancelPermissionRequest(id);
      message.success(t("account.permissionRequests.cancel"));
      setDetail(await getPermissionRequest(id));
      await load(tab, offset);
      notifyPermissionRequestTodoSummaryChanged();
    } catch (error) {
      message.error(t(mutationError(error)));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };
  const defaultColumns = [
    {
      title: t("account.permissionRequests.type"),
      width: 168,
      render: (_: unknown, row: PermissionRequest) => <Tag color="blue">{requestType(row)}</Tag>,
    },
    {
      title: t("account.permissionRequests.content"),
      width: 350,
      render: (_: unknown, row: PermissionRequest) =>
        truncatedText(requestContent(row), requestContentText(row), 2),
    },
    {
      title: t("account.permissionRequests.reason"),
      width: 220,
      render: (_: unknown, row: PermissionRequest) => {
        const reason = row.reason?.trim() || t("account.permissionRequests.noReason");
        return truncatedText(reason, reason, 2);
      },
    },
    {
      title: t("account.permissionRequests.requester"),
      width: 160,
      render: (_: unknown, row: PermissionRequest) =>
        truncatedText(row.requester_name || "-", row.requester_name || "-"),
    },
    {
      title: t("account.permissionRequests.createdAt"),
      dataIndex: "created_at",
      width: 190,
      render: (value: string) => (
        <span style={{ whiteSpace: "nowrap" }}>{formatRequestTime(value)}</span>
      ),
    },
    {
      title: t("account.permissionRequests.actions"),
      width: 136,
      align: "center" as const,
      render: (_: unknown, row: PermissionRequest) => {
        if (tab === "todo" && row.status === "pending")
          return (
            <Button type="link" onClick={() => void openDetail(row.id)}>
              {t("account.permissionRequests.review")}
            </Button>
          );
        return null;
      },
    },
  ];
  const reviewedColumns = [
    {
      title: t("account.permissionRequests.type"),
      width: 190,
      render: (_: unknown, row: PermissionRequest) => <Tag color="blue">{requestType(row)}</Tag>,
    },
    {
      title: t("account.permissionRequests.content"),
      width: 380,
      render: (_: unknown, row: PermissionRequest) =>
        truncatedText(requestContent(row), requestContentText(row), 2),
    },
    {
      title: t("account.permissionRequests.initiator"),
      width: 180,
      render: (_: unknown, row: PermissionRequest) =>
        truncatedText(row.requester_name || "-", row.requester_name || "-"),
    },
    {
      title: t("account.permissionRequests.reviewedAt"),
      width: 190,
      render: (_: unknown, row: PermissionRequest) => (
        <span style={{ whiteSpace: "nowrap" }}>
          {row.reviewed_at ? formatRequestTime(row.reviewed_at) : "-"}
        </span>
      ),
    },
    {
      title: t("account.permissionRequests.status"),
      width: 130,
      render: (_: unknown, row: PermissionRequest) => (
        <Tag color={requestStatusColor(row.status)}>{requestStatus(row.status)}</Tag>
      ),
    },
  ];
  const mineColumns = [
    {
      title: t("account.permissionRequests.type"),
      width: 190,
      render: (_: unknown, row: PermissionRequest) => <Tag color="blue">{requestType(row)}</Tag>,
    },
    {
      title: t("account.permissionRequests.content"),
      width: 400,
      render: (_: unknown, row: PermissionRequest) =>
        truncatedText(requestContent(row), requestContentText(row), 2),
    },
    {
      title: t("account.permissionRequests.reviewer"),
      width: 180,
      render: (_: unknown, row: PermissionRequest) =>
        truncatedText(reviewerDisplayName(row), reviewerDisplayName(row)),
    },
    {
      title: t("account.permissionRequests.status"),
      width: 140,
      render: (_: unknown, row: PermissionRequest) => (
        <Tag color={requestStatusColor(row.status)}>{requestStatus(row.status)}</Tag>
      ),
    },
    {
      title: t("account.permissionRequests.actions"),
      width: 112,
      align: "center" as const,
      render: (_: unknown, row: PermissionRequest) =>
        row.status === "pending" ? (
          <Popconfirm
            cancelButtonProps={{ disabled: submitting }}
            description={t("account.permissionRequests.cancelConfirmDescription")}
            okButtonProps={{ danger: true, loading: submitting }}
            okText={t("account.permissionRequests.cancel")}
            onConfirm={() => {
              void cancel(row.id);
            }}
            title={t("account.permissionRequests.cancelConfirmTitle")}
          >
            <Button danger disabled={submitting} type="link">
              {t("account.permissionRequests.cancel")}
            </Button>
          </Popconfirm>
        ) : null,
    },
  ];
  const columns =
    tab === "reviewed" ? reviewedColumns : tab === "mine" ? mineColumns : defaultColumns;

  const tabs = [
    { key: "todo", label: t("account.permissionRequests.tabs.todo") },
    { key: "reviewed", label: t("account.permissionRequests.tabs.reviewed") },
    ...(!hideMine ? [{ key: "mine", label: t("account.permissionRequests.tabs.mine") }] : []),
  ];
  const resourceTypes = [
    "knowledge_network",
    "concept_group",
    "object_type",
    "relation_type",
    "action_type",
    "metric",
    "catalog",
    "resource",
    "tool_box",
    "function",
    "mcp",
    "skill",
  ];
  const statuses = [
    "pending",
    "granted",
    "rejected",
    "cancelled",
    "resource_deleted",
    "invalidated",
  ];
  const updateFilter = (patch: RequestFilter) => {
    const next = { ...filtersRef.current[tab], ...patch };
    const normalized = Object.fromEntries(Object.entries(next).filter(([, value]) => value));
    const nextFilters = normalized as RequestFilter;
    setFilters((current) => ({ ...current, [tab]: nextFilters }));
    setOffset(0);
    void load(tab, 0, nextFilters);
  };
  const updateKeyword = (value: string, immediate = false) => {
    setSearchInputs((current) => ({ ...current, [tab]: value }));
    if (searchTimerRef.current !== undefined) window.clearTimeout(searchTimerRef.current);
    const apply = () =>
      updateFilter({ resourceName: "", requester: "", [searchScopes[tab]]: value.trim() });
    if (immediate || !value) {
      apply();
      return;
    }
    searchTimerRef.current = window.setTimeout(apply, 300);
  };
  const resetFilters = () => {
    if (searchTimerRef.current !== undefined) {
      window.clearTimeout(searchTimerRef.current);
      searchTimerRef.current = undefined;
    }
    setSearchInputs((current) => ({ ...current, [tab]: "" }));
    setSearchScopes((current) => ({ ...current, [tab]: "resourceName" }));
    setFilters((current) => ({ ...current, [tab]: {} }));
    setOffset(0);
    void load(tab, 0, {});
  };
  const updateSearchScope = (scope: "resourceName" | "requester", keyword = searchInputs[tab]) => {
    if (searchTimerRef.current !== undefined) {
      window.clearTimeout(searchTimerRef.current);
      searchTimerRef.current = undefined;
    }
    setSearchScopes((current) => ({ ...current, [tab]: scope }));
    updateFilter({ resourceName: "", requester: "", [scope]: keyword.trim() });
  };
  const hasFilters = Object.keys(filters[tab]).length > 0;

  useEffect(
    () => () => {
      if (searchTimerRef.current !== undefined) window.clearTimeout(searchTimerRef.current);
    },
    [],
  );

  return (
    <Tabs
      activeKey={tab}
      destroyOnHidden
      onChange={(key) => setTab(key as Tab)}
      items={tabs.map((item) => ({
        ...item,
        children: (
          <>
            <div className={styles.filters}>
              <Select
                allowClear
                onChange={(resourceType) => updateFilter({ resourceType })}
                options={resourceTypes.map((value) => ({
                  key: value,
                  label: requestType({ resource_type: value } as PermissionRequest),
                  value,
                }))}
                placeholder={t("account.permissionRequests.filterResourceType")}
                value={filters[tab].resourceType}
              />
              {tab !== "todo" ? (
                <Select
                  allowClear
                  onChange={(status) => updateFilter({ status })}
                  options={statuses.map((value) => ({ label: requestStatus(value), value }))}
                  placeholder={t("account.permissionRequests.filterStatus")}
                  value={filters[tab].status}
                />
              ) : null}
              {hasFilters ? (
                <Button onClick={resetFilters} type="link">
                  {t("account.permissionRequests.resetFilters")}
                </Button>
              ) : null}
              <AutoComplete
                className={styles.search}
                onSelect={(value, option) => {
                  const scope = (option as { scope: "resourceName" | "requester" }).scope;
                  // The option value intentionally remains the keyword, rather than the
                  // backend filter field name.  Otherwise AutoComplete writes values such
                  // as "requester" into the input after an option is selected.
                  const keyword = String(value);
                  if (searchTimerRef.current !== undefined) {
                    window.clearTimeout(searchTimerRef.current);
                    searchTimerRef.current = undefined;
                  }
                  setSearchInputs((current) => ({ ...current, [tab]: keyword }));
                  updateSearchScope(scope, keyword);
                }}
                options={
                  searchInputs[tab].trim()
                    ? [
                        {
                          key: "resourceName",
                          label: `${t("account.permissionRequests.searchResourceName")}：${searchInputs[tab]}`,
                          scope: "resourceName",
                          value: searchInputs[tab],
                        },
                        ...(tab === "mine"
                          ? []
                          : [
                              {
                                key: "requester",
                                label: `${t(tab === "todo" ? "account.permissionRequests.searchRequester" : "account.permissionRequests.searchInitiator")}：${searchInputs[tab]}`,
                                scope: "requester",
                                value: searchInputs[tab],
                              },
                            ]),
                      ]
                    : []
                }
              >
                <Input.Search
                  allowClear
                  onChange={(event) => updateKeyword(event.target.value)}
                  onSearch={(keyword) => updateKeyword(keyword, true)}
                  placeholder={t(
                    tab === "mine"
                      ? "account.permissionRequests.searchResourceName"
                      : "account.permissionRequests.searchPlaceholder",
                  )}
                  value={searchInputs[tab]}
                />
              </AutoComplete>
            </div>
            <Table
              rowKey="id"
              loading={loading}
              dataSource={rows}
              onRow={(row) => ({
                className: styles.requestRow,
                onClick: (event) => {
                  const target = event.target as HTMLElement;
                  if (!target.closest("button, a, [role='button']")) void openDetail(row.id);
                },
              })}
              scroll={{ x: tab === "todo" ? 1336 : 1134 }}
              pagination={{
                current: Math.floor(offset / pageSize) + 1,
                pageSize,
                showQuickJumper: true,
                showSizeChanger: false,
                showTotal: (count) => t("common.total", { total: count }),
                total,
                onChange: (page) => {
                  const nextOffset = (page - 1) * pageSize;
                  setOffset(nextOffset);
                  void load(tab, nextOffset);
                },
              }}
              columns={columns}
            />
            <Drawer
              title={
                detail ? (
                  <span className={styles.drawerTitle}>
                    {t("account.permissionRequests.requestDetailTitle", {
                      requester: detail.requester_name || "-",
                      type: requestType(detail),
                    })}
                  </span>
                ) : (
                  t("account.permissionRequests.requestDetails")
                )
              }
              extra={
                detail ? (
                  <div className={`${styles.statusSeal} ${statusSealClass(detail.status)}`}>
                    <span>{requestStatus(detail.status)}</span>
                  </div>
                ) : null
              }
              open={detail !== null}
              onClose={closeDetail}
              closable={!submitting}
              keyboard={!submitting}
              maskClosable={!submitting}
              width={520}
            >
              {detail?.operations?.includes("full_business_access") && (
                <Alert
                  type="warning"
                  showIcon
                  message={t("account.permissionRequests.fullAccessTitle")}
                  description={t("account.permissionRequests.fullAccessDescription")}
                  style={{ marginBottom: 16 }}
                />
              )}
              {detail?.status === "invalidated" && (
                <Alert
                  type="warning"
                  showIcon
                  message={t("account.permissionRequests.invalidated")}
                  description={t("account.permissionRequests.invalidatedNotice")}
                  style={{ marginBottom: 16 }}
                />
              )}
              {detail && (
                <div className={styles.summary}>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>
                      {t("account.permissionRequests.type")}：
                    </span>
                    <span className={styles.summaryValue}>{requestType(detail)}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>
                      {t("account.permissionRequests.content")}：
                    </span>
                    <span className={styles.summaryValue}>{requestContent(detail)}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>
                      {t("account.permissionRequests.reason")}：
                    </span>
                    <span className={styles.summaryValue}>{detail.reason}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>
                      {t("account.permissionRequests.requester")}：
                    </span>
                    <span className={styles.summaryValue}>{detail.requester_name || "-"}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>
                      {t("account.permissionRequests.reviewer")}：
                    </span>
                    <span className={styles.summaryValue}>{reviewerDisplayName(detail)}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>
                      {t("account.permissionRequests.createdAt")}：
                    </span>
                    <span className={styles.summaryValue}>
                      {formatRequestTime(detail.created_at)}
                    </span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>
                      {t("account.permissionRequests.resourceDetails")}：
                    </span>
                    <span className={styles.summaryValue}>{resourceDetailsAction(detail)}</span>
                  </div>
                </div>
              )}
              {detail?.status === "pending" && tab === "todo" && (
                <>
                  <Input.TextArea
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    maxLength={512}
                    placeholder={t("account.permissionRequests.reviewComment")}
                    style={{ marginTop: 16 }}
                  />
                  <div style={{ marginTop: 12 }}>
                    <Popconfirm
                      cancelButtonProps={{ disabled: submitting }}
                      description={t("account.permissionRequests.approveConfirmDescription")}
                      okButtonProps={{ loading: submitting }}
                      okText={t("account.permissionRequests.approve")}
                      onConfirm={() => {
                        void decide(detail.id, "approve", comment);
                      }}
                      title={t("account.permissionRequests.approveConfirmTitle")}
                    >
                      <Button disabled={submitting} loading={submitting} type="primary">
                        {t("account.permissionRequests.approve")}
                      </Button>
                    </Popconfirm>
                    <Popconfirm
                      cancelButtonProps={{ disabled: submitting }}
                      description={t("account.permissionRequests.rejectConfirmDescription")}
                      okButtonProps={{ danger: true, loading: submitting }}
                      okText={t("account.permissionRequests.reject")}
                      onConfirm={() => {
                        void decide(detail.id, "reject", comment);
                      }}
                      title={t("account.permissionRequests.rejectConfirmTitle")}
                    >
                      <Button danger disabled={submitting} style={{ marginLeft: 8 }}>
                        {t("account.permissionRequests.reject")}
                      </Button>
                    </Popconfirm>
                  </div>
                </>
              )}
              {detail?.status === "pending" && tab === "mine" && (
                <div style={{ marginTop: 12 }}>
                  <Popconfirm
                    cancelButtonProps={{ disabled: submitting }}
                    description={t("account.permissionRequests.cancelConfirmDescription")}
                    okButtonProps={{ danger: true, loading: submitting }}
                    okText={t("account.permissionRequests.cancel")}
                    onConfirm={() => {
                      void cancel(detail.id);
                    }}
                    title={t("account.permissionRequests.cancelConfirmTitle")}
                  >
                    <Button disabled={submitting}>{t("account.permissionRequests.cancel")}</Button>
                  </Popconfirm>
                </div>
              )}
              <Divider />
              <h4 className={styles.sectionTitle}>{t("account.permissionRequests.process")}：</h4>
              {detail && (
                <Timeline
                  items={[
                    {
                      dot: (
                        <Avatar style={{ backgroundColor: "#4f67ad" }}>
                          {avatarInitial(detail.requester_name)}
                        </Avatar>
                      ),
                      children: (
                        <div>
                          <div className={styles.timelineName}>{detail.requester_name || "-"}</div>
                          <div className={`${styles.timelineStatus} ${styles.started}`}>
                            {t("account.permissionRequests.started")}
                          </div>
                          <div className={styles.timelineTime}>
                            {formatRequestTime(detail.created_at)}
                          </div>
                        </div>
                      ),
                    },
                    ...reviews.map((review) => ({
                      dot: (
                        <Avatar
                          style={{
                            backgroundColor: review.decision === "approve" ? "#1677ff" : "#ff7875",
                          }}
                        >
                          {avatarInitial(reviewActorName(review))}
                        </Avatar>
                      ),
                      children: (
                        <div>
                          <div className={styles.timelineName}>{reviewActorName(review)}</div>
                          <div
                            className={`${styles.timelineStatus} ${review.decision === "approve" ? styles.approved : styles.rejected}`}
                          >
                            {t("account.permissionRequests.review")}：
                            {reviewDecision(review.decision)}
                          </div>
                          {review.comment ? (
                            <div className={styles.timelineComment}>{review.comment}</div>
                          ) : null}
                          <div className={styles.timelineTime}>
                            {formatRequestTime(review.created_at)}
                          </div>
                        </div>
                      ),
                    })),
                    ...(detail.status === "pending"
                      ? [
                          {
                            color: "blue" as const,
                            children: (
                              <div>
                                <div className={styles.timelineName}>
                                  {reviewerDisplayName(detail)}
                                </div>
                                <div className={`${styles.timelineStatus} ${styles.pending}`}>
                                  {t("account.permissionRequests.pendingReview")}
                                </div>
                              </div>
                            ),
                          },
                        ]
                      : [
                          {
                            color:
                              detail.status === "granted"
                                ? ("green" as const)
                                : detail.status === "cancelled"
                                  ? ("gray" as const)
                                  : ("red" as const),
                            children: (
                              <div>
                                <div
                                  className={`${styles.timelineStatus} ${detail.status === "granted" ? styles.approved : detail.status === "cancelled" ? styles.cancelled : styles.rejected}`}
                                >
                                  {detail.status === "granted"
                                    ? t("account.permissionRequests.approved")
                                    : detail.status === "rejected"
                                      ? t("account.permissionRequests.rejected")
                                      : detail.status === "cancelled"
                                        ? t("account.permissionRequests.cancelled")
                                        : detail.status === "invalidated"
                                          ? t("account.permissionRequests.invalidated")
                                          : t("account.permissionRequests.resourceDeleted")}
                                </div>
                              </div>
                            ),
                          },
                        ]),
                  ]}
                />
              )}
            </Drawer>
          </>
        ),
      }))}
    />
  );
}
