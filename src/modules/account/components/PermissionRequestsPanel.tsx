/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  Alert,
  Avatar,
  Button,
  Divider,
  Drawer,
  Form,
  Input,
  Space,
  Table,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
} from "antd";
import { useEffect, useState, type ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import {
  cancelPermissionRequest,
  createPermissionRequest,
  decidePermissionRequest,
  getPermissionRequest,
  listPermissionRequestReviews,
  listPermissionRequests,
  type PermissionRequest,
  type PermissionRequestReview,
} from "@/modules/account/services/permission-requests.service";

import styles from "./PermissionRequestsPanel.module.css";

type Tab = "mine" | "todo" | "reviewed";
type ApplyForm = {
  resourceType: string;
  resourceID: string;
  resourceName?: string;
  operations: string;
  reason: string;
};
const pageSize = 20;

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
  // Functions are listed underneath their Tool Box and their request identity
  // does not carry that parent ID. Open the function management list instead.
  if (request.resource_type === "function") return "execution-factory/units";
  return undefined;
}

export function PermissionRequestsPanel({ hideMine = false }: { hideMine?: boolean }) {
  const { message } = useAppServices();
  const { i18n, t } = useTranslation();
  const [tab, setTab] = useState<Tab>("todo");
  const [rows, setRows] = useState<PermissionRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<PermissionRequest | null>(null);
  const [reviews, setReviews] = useState<PermissionRequestReview[]>([]);
  const [comment, setComment] = useState("");
  const [form] = Form.useForm<ApplyForm>();

  const requestOperations = (request: PermissionRequest) =>
    (request.operations?.length ? request.operations : [request.operation])
      .map((operation) =>
        t(`account.permissionRequests.operationNames.${operation}`, { defaultValue: operation }),
      )
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
    if (status === "rejected" || status === "resource_deleted") return "error";
    if (status === "pending") return "processing";
    if (status === "no_reviewer") return "warning";
    return undefined;
  };
  const statusSealClass = (status: string) => {
    if (status === "granted") return styles.statusGranted;
    if (status === "rejected" || status === "resource_deleted") return styles.statusRejected;
    if (status === "pending") return styles.statusPending;
    return styles.statusDefault;
  };
  const reviewActorName = (review: PermissionRequestReview) =>
    review.reviewer_name ||
    (detail?.reviewer_id === review.reviewer_id ? detail.reviewer_name : "-");
  const openResourceDetail = (request: PermissionRequest) => {
    if (request.status === "resource_deleted") return;
    const path = resourceDetailPath(request);
    if (path) window.open(`${import.meta.env.BASE_URL}${path}`, "_blank", "noopener,noreferrer");
  };
  const requestContent = (request: PermissionRequest) => (
    <Trans
      components={{
        resource: (
          <Button
            className={`${styles.detailLink} ${styles.resourcePill}`}
            disabled={request.status === "resource_deleted"}
            onClick={() => openResourceDetail(request)}
            type="link"
          />
        ),
        operations: <span className={styles.operationPill} />,
      }}
      i18nKey="account.permissionRequests.contentValue"
      values={{ resource: resourceName(request), operations: requestOperations(request) }}
    />
  );
  const formatRequestTime = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "medium" }).format(
          date,
        );
  };
  const load = async (next = tab, nextOffset = offset) => {
    setLoading(true);
    try {
      const page = await listPermissionRequests(next, pageSize, nextOffset);
      setRows(page.entries);
      setTotal(page.total_count);
    } catch {
      message.error(t("account.permissionRequests.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setOffset(0);
    void load(tab, 0);
    const timer = window.setInterval(() => void load(tab, 0), 30000);
    return () => window.clearInterval(timer);
  }, [tab]);

  const openDetail = async (id: string) => {
    try {
      const [request, nextReviews] = await Promise.all([
        getPermissionRequest(id),
        listPermissionRequestReviews(id),
      ]);
      setDetail(request);
      setReviews(nextReviews);
    } catch {
      message.error(t("account.permissionRequests.detailsFailed"));
    }
  };
  const decide = async (id: string, decision: "approve" | "reject") => {
    try {
      await decidePermissionRequest(id, decision, comment);
      setComment("");
      message.success(
        t(
          decision === "approve"
            ? "account.permissionRequests.approveSuccess"
            : "account.permissionRequests.rejectSuccess",
        ),
      );
      await load();
      if (detail?.id === id) await openDetail(id);
    } catch {
      message.error(t("account.permissionRequests.decisionFailed"));
    }
  };
  const cancel = async (id: string) => {
    try {
      await cancelPermissionRequest(id);
      message.success(t("account.permissionRequests.cancel"));
      await load();
    } catch {
      message.error(t("account.permissionRequests.decisionFailed"));
    }
  };
  const apply = async (values: ApplyForm) => {
    const operations = values.operations
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    try {
      await createPermissionRequest({ ...values, operations });
      form.resetFields();
      setTab("mine");
    } catch {
      message.error(t("account.permissionRequests.decisionFailed"));
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
      render: (_: unknown, row: PermissionRequest) => truncatedText(row.reason, row.reason, 2),
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
      title: t("account.permissionRequests.details"),
      width: 112,
      align: "center" as const,
      render: (_: unknown, row: PermissionRequest) => (
        <Button type="link" onClick={() => void openDetail(row.id)}>
          {t("account.permissionRequests.viewDetails")}
        </Button>
      ),
    },
    {
      title: t("account.permissionRequests.actions"),
      width: 136,
      align: "center" as const,
      render: (_: unknown, row: PermissionRequest) => {
        if (tab === "todo" && row.status === "pending")
          return (
            <Space size={0}>
              <Button type="link" onClick={() => void decide(row.id, "approve")}>
                {t("account.permissionRequests.approve")}
              </Button>
              <Button danger type="link" onClick={() => void decide(row.id, "reject")}>
                {t("account.permissionRequests.reject")}
              </Button>
            </Space>
          );
        if (tab === "mine" && row.status === "pending")
          return (
            <Button danger type="link" onClick={() => void cancel(row.id)}>
              {t("account.permissionRequests.cancel")}
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
    {
      title: t("account.permissionRequests.details"),
      width: 112,
      align: "center" as const,
      render: (_: unknown, row: PermissionRequest) => (
        <Button type="link" onClick={() => void openDetail(row.id)}>
          {t("account.permissionRequests.viewDetails")}
        </Button>
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
        truncatedText(row.reviewer_name || "-", row.reviewer_name || "-"),
    },
    {
      title: t("account.permissionRequests.status"),
      width: 140,
      render: (_: unknown, row: PermissionRequest) => (
        <Tag color={requestStatusColor(row.status)}>{requestStatus(row.status)}</Tag>
      ),
    },
    {
      title: t("account.permissionRequests.details"),
      width: 112,
      align: "center" as const,
      render: (_: unknown, row: PermissionRequest) => (
        <Button type="link" onClick={() => void openDetail(row.id)}>
          {t("account.permissionRequests.viewDetails")}
        </Button>
      ),
    },
    {
      title: t("account.permissionRequests.actions"),
      width: 112,
      align: "center" as const,
      render: (_: unknown, row: PermissionRequest) =>
        row.status === "pending" ? (
          <Button danger type="link" onClick={() => void cancel(row.id)}>
            {t("account.permissionRequests.cancel")}
          </Button>
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

  return (
    <Tabs
      activeKey={tab}
      onChange={(key) => setTab(key as Tab)}
      items={tabs.map((item) => ({
        ...item,
        children: (
          <>
            {tab === "mine" && (
              <Form form={form} layout="inline" onFinish={(values) => void apply(values)}>
                <Form.Item name="resourceType" rules={[{ required: true }]}>
                  <Input placeholder={t("account.permissionRequests.resourceTypePlaceholder")} />
                </Form.Item>
                <Form.Item name="resourceID" rules={[{ required: true }]}>
                  <Input placeholder={t("account.permissionRequests.resourceIDPlaceholder")} />
                </Form.Item>
                <Form.Item name="resourceName">
                  <Input placeholder={t("account.permissionRequests.resourceNamePlaceholder")} />
                </Form.Item>
                <Form.Item name="operations" rules={[{ required: true }]}>
                  <Input placeholder={t("account.permissionRequests.operationsPlaceholder")} />
                </Form.Item>
                <Form.Item name="reason">
                  <Input placeholder={t("account.permissionRequests.reason")} />
                </Form.Item>
                <Button type="primary" htmlType="submit">
                  {t("account.permissionRequests.create")}
                </Button>
              </Form>
            )}
            <Table
              rowKey="id"
              loading={loading}
              dataSource={rows}
              scroll={{ x: tab === "todo" ? 1336 : 1134 }}
              pagination={{
                current: Math.floor(offset / pageSize) + 1,
                pageSize,
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
              onClose={() => setDetail(null)}
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
                    <span className={styles.summaryValue}>{detail.reviewer_name || "-"}</span>
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
                    <span className={styles.summaryValue}>
                      <Button
                        className={styles.detailLink}
                        type="link"
                        disabled={detail.status === "resource_deleted"}
                        onClick={() => openResourceDetail(detail)}
                      >
                        {t("account.permissionRequests.viewResourceDetails")}
                      </Button>
                    </span>
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
                    <Button type="primary" onClick={() => void decide(detail.id, "approve")}>
                      {t("account.permissionRequests.approve")}
                    </Button>
                    <Button
                      danger
                      style={{ marginLeft: 8 }}
                      onClick={() => void decide(detail.id, "reject")}
                    >
                      {t("account.permissionRequests.reject")}
                    </Button>
                  </div>
                </>
              )}
              {detail?.status === "pending" && tab === "mine" && (
                <div style={{ marginTop: 12 }}>
                  <Button onClick={() => void cancel(detail.id)}>
                    {t("account.permissionRequests.cancel")}
                  </Button>
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
                                  {detail.reviewer_name || "-"}
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
                              detail.status === "resource_deleted"
                                ? ("red" as const)
                                : ("green" as const),
                            children: (
                              <div>
                                <div
                                  className={`${styles.timelineStatus} ${detail.status === "resource_deleted" ? styles.rejected : styles.approved}`}
                                >
                                  {detail.status === "resource_deleted"
                                    ? t("account.permissionRequests.resourceDeleted")
                                    : t("account.permissionRequests.reviewEnded")}
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
