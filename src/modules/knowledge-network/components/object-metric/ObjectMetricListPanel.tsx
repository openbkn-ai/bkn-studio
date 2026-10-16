/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  DeleteOutlined,
  EditOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  Button,
  Dropdown,
  Empty,
  Input,
  Modal,
  Pagination,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from "antd";
import type { TableProps } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { ObjectMetricGraphCanvas } from "@/modules/knowledge-network/components/object-metric/ObjectMetricGraphCanvas";
import { usePersistentPageSize } from "@/modules/knowledge-network/components/shared/usePersistentPageSize";
import {
  createNextObjectMetricDraftV1,
  deleteObjectMetricDraftV1,
  deprecateObjectMetricV1,
  listObjectMetricsV1,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import { listKnowledgeNetworkObjectTypePage } from "@/modules/knowledge-network/services/object-type.service";
import type {
  ObjectMetricRecordV1,
  ObjectMetricTypeV1,
} from "@/modules/knowledge-network/types/object-metric";
import type { KnowledgeNetworkObjectTypeRecord } from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ObjectMetricListPanel.module.css";
import metricTheme from "./ObjectMetricTheme.module.css";
import { objectMetricText } from "@/modules/knowledge-network/lib/object-metric-text";
import { useTranslation } from "react-i18next";

type Props = { canModify: boolean; networkId: string };

const PAGE_SIZE_STORAGE_SCOPE = "object-metrics";
const OBJECT_PAGE_SIZE = 20;
const COUNT_CONCURRENCY = 4;

const typeNames: Record<ObjectMetricTypeV1, string> = {
  get atomic() {
    return objectMetricText("me5675ba4c2fd");
  },
  get composite() {
    return objectMetricText("m3e70c815f275");
  },
  get derived() {
    return objectMetricText("me88b222ae28a");
  },
};
const statusNames = {
  get deprecated() {
    return objectMetricText("m1948aabb85ed");
  },
  get draft() {
    return objectMetricText("m2a2fd29bd27a");
  },
  get published() {
    return objectMetricText("md334724d6b2f");
  },
  get validated() {
    return objectMetricText("m1936eafc0c3c");
  },
};

export function ObjectMetricListPanel({ canModify, networkId }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message } = useAppServices();
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [objectTypes, setObjectTypes] = useState<KnowledgeNetworkObjectTypeRecord[]>([]);
  const [objectMetricCounts, setObjectMetricCounts] = useState<Record<string, number | null>>({});
  const [objectTotal, setObjectTotal] = useState(0);
  const [objectPage, setObjectPage] = useState(1);
  const [objectSidebarCollapsed, setObjectSidebarCollapsed] = useState(false);
  const [listMetrics, setListMetrics] = useState<ObjectMetricRecordV1[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [listResultKey, setListResultKey] = useState("");
  const [selectedObjectTypeId, setSelectedObjectTypeId] = useState("");
  const [selectedObjectTypeName, setSelectedObjectTypeName] = useState("");
  const [objectKeyword, setObjectKeyword] = useState("");
  const [debouncedObjectKeyword, setDebouncedObjectKeyword] = useState("");
  const [metricKeyword, setMetricKeyword] = useState("");
  const [debouncedMetricKeyword, setDebouncedMetricKeyword] = useState("");
  const [metricType, setMetricType] = useState<ObjectMetricTypeV1 | undefined>();
  const [viewMode, setViewMode] = useState<"graph" | "list">("graph");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentPageSize(PAGE_SIZE_STORAGE_SCOPE, 10);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const listRequestKey = JSON.stringify([
    networkId,
    selectedObjectTypeId,
    debouncedMetricKeyword,
    metricType,
    page,
    pageSize,
    refreshVersion,
  ]);
  const listCurrent = listResultKey === listRequestKey;
  const messageRef = useRef(message);
  const selectedObjectRef = useRef({ id: selectedObjectTypeId, name: selectedObjectTypeName });
  const tableViewportRef = useRef<HTMLDivElement>(null);
  const objectListRef = useRef<HTMLDivElement>(null);
  const objectMetricCountCache = useRef(new Map<string, number | null>());

  useEffect(() => {
    messageRef.current = message;
  }, [message]);

  useEffect(() => {
    selectedObjectRef.current = { id: selectedObjectTypeId, name: selectedObjectTypeName };
  }, [selectedObjectTypeId, selectedObjectTypeName]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void listKnowledgeNetworkObjectTypePage(
      networkId,
      {
        direction: "asc",
        limit: OBJECT_PAGE_SIZE,
        namePattern: debouncedObjectKeyword || undefined,
        offset: (objectPage - 1) * OBJECT_PAGE_SIZE,
        sort: "name",
      },
      { skipErrorToast: true },
    )
      .then((result) => {
        if (!active) return;
        const maxPage = Math.max(1, Math.ceil(result.totalCount / OBJECT_PAGE_SIZE));
        setObjectTotal(result.totalCount);
        if (objectPage > maxPage) {
          setObjectTypes([]);
          setObjectPage(maxPage);
          return;
        }
        setObjectTypes(result.entries);
        const first = result.entries[0];
        const currentSelection = selectedObjectRef.current;
        if (first && (!currentSelection.id || debouncedObjectKeyword)) {
          setSelectedObjectTypeId(first.id);
          setSelectedObjectTypeName(first.name);
        } else if (!first && result.totalCount === 0) {
          setSelectedObjectTypeId("");
          setSelectedObjectTypeName("");
        } else {
          const selected = result.entries.find((item) => item.id === currentSelection.id);
          if (selected) setSelectedObjectTypeName(selected.name);
        }
      })
      .catch(() => {
        if (active) {
          setObjectTypes([]);
          setObjectTotal(0);
          void messageRef.current.error(objectMetricText("m51fc5b3bc879"));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [debouncedObjectKeyword, networkId, objectPage, refreshVersion]);

  useEffect(() => {
    let active = true;
    const countKey = (id: string) => `${networkId}\0${id}`;
    const pending = objectTypes.filter(
      (item) => !objectMetricCountCache.current.has(countKey(item.id)),
    );
    setObjectMetricCounts(
      Object.fromEntries(
        objectTypes
          .filter((item) => objectMetricCountCache.current.has(countKey(item.id)))
          .map((item) => [item.id, objectMetricCountCache.current.get(countKey(item.id))!]),
      ),
    );

    let nextIndex = 0;
    async function loadCounts() {
      while (active && nextIndex < pending.length) {
        const item = pending[nextIndex++];
        let count: number | null = null;
        try {
          const result = await listObjectMetricsV1(
            networkId,
            { limit: 1, offset: 0, ownerObjectTypeId: item.id },
            { skipErrorToast: true },
          );
          count = result.total_count;
        } catch {
          // A failed count must not look like an actual zero.
        }
        if (active) {
          objectMetricCountCache.current.set(countKey(item.id), count);
          setObjectMetricCounts((current) => ({ ...current, [item.id]: count }));
        }
      }
    }
    for (let worker = 0; worker < Math.min(COUNT_CONCURRENCY, pending.length); worker += 1) {
      void loadCounts();
    }
    return () => {
      active = false;
    };
  }, [networkId, objectTypes, refreshVersion]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedObjectKeyword(objectKeyword.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [objectKeyword]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedMetricKeyword(metricKeyword.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [metricKeyword]);

  useEffect(() => {
    if (viewMode !== "list") {
      return;
    }

    let cancelled = false;
    setListLoading(true);
    void listObjectMetricsV1(networkId, {
      keyword: debouncedMetricKeyword || undefined,
      limit: pageSize,
      metricType,
      offset: (page - 1) * pageSize,
      ownerObjectTypeId: selectedObjectTypeId || undefined,
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        const maxPage = Math.max(1, Math.ceil(result.total_count / pageSize));
        setListTotal(result.total_count);
        if (page > maxPage) {
          setListMetrics([]);
          setPage(maxPage);
          return;
        }
        setListMetrics(result.entries);
        setListResultKey(listRequestKey);
      })
      .catch(() => {
        if (!cancelled) {
          setListMetrics([]);
          setListTotal(0);
          setListResultKey(listRequestKey);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setListLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    debouncedMetricKeyword,
    listRequestKey,
    refreshVersion,
    metricType,
    networkId,
    page,
    pageSize,
    selectedObjectTypeId,
    viewMode,
  ]);

  const refresh = useCallback(() => {
    objectMetricCountCache.current.clear();
    setObjectMetricCounts({});
    setRefreshVersion((current) => current + 1);
  }, []);

  const openCreate = (type: ObjectMetricTypeV1) => {
    if (!selectedObjectTypeId) return;
    void navigate(
      `/knowledge-network/workspace/${networkId}/metrics/create?objectTypeId=${encodeURIComponent(selectedObjectTypeId)}&metricType=${type}`,
    );
  };

  const openEditor = async (record: ObjectMetricRecordV1) => {
    if (["published", "deprecated"].includes(record.definition.lifecycle.status)) {
      await createNextObjectMetricDraftV1(networkId, record.definition.id);
    }
    void navigate(`/knowledge-network/workspace/${networkId}/metrics/${record.definition.id}/edit`);
  };

  const columns: TableProps<ObjectMetricRecordV1>["columns"] = [
    {
      key: "name",
      title: objectMetricText("mb87e67c7dae0"),
      width: 280,
      render: (_, record) => (
        <div className={styles.nameCell}>
          <strong title={record.definition.name}>{record.definition.name}</strong>
        </div>
      ),
    },
    {
      key: "type",
      title: objectMetricText("mba40014ff496"),
      width: 110,
      render: (_, record) => (
        <Tag
          color={
            record.definition.metric_type === "atomic"
              ? "blue"
              : record.definition.metric_type === "derived"
                ? "green"
                : "purple"
          }
        >
          {typeNames[record.definition.metric_type]}
        </Tag>
      ),
    },
    {
      key: "scope",
      title: objectMetricText("mec7844e49915"),
      width: 120,
      render: (_, record) =>
        record.definition.calculation_scope === "object_instance"
          ? objectMetricText("mabe9d02781fc")
          : objectMetricText("m9c51e86f9307"),
    },
    {
      key: "status",
      title: objectMetricText("m6320b4a8722a"),
      width: 100,
      render: (_, record) => (
        <Tag color={record.definition.lifecycle.status === "published" ? "success" : "default"}>
          {statusNames[record.definition.lifecycle.status]}
        </Tag>
      ),
    },
    {
      key: "description",
      title: objectMetricText("m419eb90613fd"),
      ellipsis: true,
      render: (_, record) => record.definition.description || "--",
    },
    {
      key: "actions",
      title: objectMetricText("med31fbb483ee"),
      width: 150,
      fixed: "right",
      render: (_, record) => (
        <Space>
          <Button
            onClick={() =>
              void navigate(
                `/knowledge-network/workspace/${networkId}/metrics/${record.definition.id}/detail`,
              )
            }
            size="small"
            type="link"
          >
            {objectMetricText("m979a332955c8")}
          </Button>
          {canModify ? (
            <Tooltip
              title={
                ["published", "deprecated"].includes(record.definition.lifecycle.status)
                  ? objectMetricText("m0ae9e2e1ef17")
                  : objectMetricText("mec3ba1e99684")
              }
            >
              <Button
                aria-label={objectMetricText("m79bef996428f", { p0: record.definition.name })}
                icon={<EditOutlined />}
                onClick={() => void openEditor(record)}
                size="small"
                type="text"
              />
            </Tooltip>
          ) : null}
          {canModify && ["draft", "validated"].includes(record.definition.lifecycle.status) ? (
            <Button
              aria-label={objectMetricText("m7a7c17d22328", { p0: record.definition.name })}
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                Modal.confirm({
                  content: objectMetricText("m1baf039f0b73", { p0: record.definition.name }),
                  okButtonProps: { danger: true },
                  onOk: async () => {
                    await deleteObjectMetricDraftV1(
                      networkId,
                      record.definition.id,
                      record.definition.version,
                    );
                    void message.success(objectMetricText("md393b7cc3ea3"));
                    refresh();
                  },
                  title: objectMetricText("m1dfe58237bbf"),
                });
              }}
              size="small"
              type="text"
            />
          ) : null}
          {canModify && record.definition.lifecycle.status === "published" ? (
            <Button
              danger
              onClick={() => {
                Modal.confirm({
                  content: objectMetricText("mcb05d2c2df12"),
                  okButtonProps: { danger: true },
                  onOk: async () => {
                    await deprecateObjectMetricV1(
                      networkId,
                      record.definition.id,
                      record.definition.version,
                    );
                    void message.success(objectMetricText("mda791b06ec77"));
                    refresh();
                  },
                  title: objectMetricText("ma01ab2ceb262", { p0: record.definition.name }),
                });
              }}
              size="small"
              type="link"
            >
              {objectMetricText("mca0ff1e63793")}
            </Button>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <section className={`${styles.page} ${metricTheme.scope}`}>
      <div
        className={`${styles.layout} ${objectSidebarCollapsed ? styles.layoutSidebarCollapsed : ""}`}
      >
        <aside
          className={`${styles.sidebar} ${objectSidebarCollapsed ? styles.sidebarCollapsed : ""}`}
        >
          <div className={styles.sidebarHeader}>
            {objectSidebarCollapsed ? null : (
              <div className={styles.sidebarSearch}>
                <Input
                  allowClear
                  onChange={(event) => {
                    setObjectKeyword(event.target.value);
                    setObjectPage(1);
                    setSelectedObjectTypeId("");
                    setSelectedObjectTypeName("");
                    setPage(1);
                    if (objectListRef.current) {
                      objectListRef.current.scrollTop = 0;
                    }
                  }}
                  placeholder={objectMetricText("graphSearchObjectTypes")}
                  prefix={<SearchOutlined />}
                  value={objectKeyword}
                />
              </div>
            )}
            <Tooltip
              title={objectMetricText(
                objectSidebarCollapsed ? "graphExpandObjectSidebar" : "graphCollapseObjectSidebar",
              )}
            >
              <Button
                aria-expanded={!objectSidebarCollapsed}
                aria-label={objectMetricText(
                  objectSidebarCollapsed
                    ? "graphExpandObjectSidebar"
                    : "graphCollapseObjectSidebar",
                )}
                className={styles.sidebarToggle}
                icon={objectSidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setObjectSidebarCollapsed((current) => !current)}
                type="text"
              />
            </Tooltip>
          </div>
          {objectSidebarCollapsed ? null : (
            <>
              <div className={styles.objectList} ref={objectListRef}>
                {objectTypes.map((item) => (
                  <Button
                    className={`${styles.objectButton} ${selectedObjectTypeId === item.id ? styles.selected : ""}`}
                    key={item.id}
                    onClick={() => {
                      setSelectedObjectTypeId(item.id);
                      setSelectedObjectTypeName(item.name);
                      setPage(1);
                    }}
                    title={item.name}
                    type="text"
                  >
                    <span className={styles.objectName}>{item.name}</span>
                    <span
                      aria-label={
                        typeof objectMetricCounts[item.id] === "number"
                          ? objectMetricText("graphObjectMetricCount", {
                              p0: item.name,
                              p1: objectMetricCounts[item.id]!,
                            })
                          : undefined
                      }
                      className={styles.objectCount}
                      title={
                        typeof objectMetricCounts[item.id] === "number"
                          ? objectMetricText("graphMetricCount", {
                              p0: objectMetricCounts[item.id]!,
                            })
                          : undefined
                      }
                    >
                      {objectMetricCounts[item.id] === undefined
                        ? "…"
                        : objectMetricCounts[item.id] === null
                          ? "—"
                          : objectMetricCounts[item.id]}
                    </span>
                  </Button>
                ))}
                {!objectTypes.length && !loading ? (
                  <Empty
                    description={objectMetricText("mc90d408577d0")}
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                ) : null}
              </div>
              <div
                className={`${styles.objectPagination} ${objectTotal <= OBJECT_PAGE_SIZE ? styles.objectPaginationSingle : ""}`}
              >
                <span>{objectMetricText("graphObjectTotal", { p0: objectTotal })}</span>
                {objectTotal > OBJECT_PAGE_SIZE ? (
                  <Pagination
                    current={objectPage}
                    onChange={(nextPage) => {
                      setObjectPage(nextPage);
                      if (objectListRef.current) objectListRef.current.scrollTop = 0;
                    }}
                    pageSize={OBJECT_PAGE_SIZE}
                    showSizeChanger={false}
                    simple
                    size="small"
                    total={objectTotal}
                  />
                ) : null}
              </div>
            </>
          )}
        </aside>
        <div className={`${styles.content} ${viewMode === "list" ? styles.listContent : ""}`}>
          <div className={styles.toolbar}>
            <div className={styles.toolbarLeft}>
              <div className={styles.toolbarIdentity}>
                <strong>{selectedObjectTypeName || objectMetricText("m6be07467be0f")}</strong>
                <span>{selectedObjectTypeId}</span>
              </div>
              <Segmented
                className={styles.viewSwitch}
                onChange={(value) => {
                  setViewMode(value as "graph" | "list");
                  setPage(1);
                }}
                options={[
                  { label: objectMetricText("m3b51eaa93417"), value: "graph" },
                  { label: objectMetricText("maedd6814ff8c"), value: "list" },
                ]}
                value={viewMode}
              />
            </div>
            <div className={styles.toolbarRight}>
              <Tooltip title={objectMetricText("m09f60ac5c12e")}>
                <Button
                  aria-label={objectMetricText("m09f60ac5c12e")}
                  icon={<ReloadOutlined />}
                  loading={loading || listLoading}
                  onClick={() => void refresh()}
                />
              </Tooltip>
              {viewMode === "list" ? (
                <Input
                  allowClear
                  onChange={(event) => {
                    setMetricKeyword(event.target.value);
                    setPage(1);
                  }}
                  placeholder={objectMetricText("graphSearchListMetrics")}
                  prefix={<SearchOutlined />}
                  value={metricKeyword}
                />
              ) : null}
              <Select
                allowClear
                onChange={(value) => {
                  setMetricType(value);
                  setPage(1);
                }}
                options={Object.entries(typeNames).map(([value, label]) => ({ label, value }))}
                placeholder={objectMetricText("m267c4a7a86dd")}
                value={metricType}
                style={{ width: 130 }}
              />
              {canModify ? (
                <Dropdown
                  menu={{
                    items: (["atomic", "derived", "composite"] as ObjectMetricTypeV1[]).map(
                      (type) => ({
                        key: type,
                        label: objectMetricText("m422c8208705c", { p0: typeNames[type] }),
                      }),
                    ),
                    onClick: ({ key }) => openCreate(key as ObjectMetricTypeV1),
                  }}
                >
                  <Button disabled={!selectedObjectTypeId} icon={<PlusOutlined />} type="primary">
                    {objectMetricText("mc89eb03160da")}
                  </Button>
                </Dropdown>
              ) : null}
            </div>
          </div>
          {viewMode === "graph" ? (
            <ObjectMetricGraphCanvas
              metricType={metricType}
              networkId={networkId}
              onOpenMetric={(id) =>
                void navigate(`/knowledge-network/workspace/${networkId}/metrics/${id}/detail`)
              }
              onSelectObject={(objectTypeId, objectTypeName) => {
                setSelectedObjectTypeId(objectTypeId);
                setSelectedObjectTypeName(objectTypeName);
                setPage(1);
              }}
              onSwitchList={() => setViewMode("list")}
              refreshVersion={refreshVersion}
              selectedObjectTypeId={selectedObjectTypeId}
              selectedObjectTypeName={selectedObjectTypeName}
            />
          ) : (
            <div className={styles.listView}>
              <div className={styles.tableViewport} ref={tableViewportRef}>
                <Table
                  columns={columns}
                  dataSource={listCurrent ? listMetrics : []}
                  loading={listLoading || !listCurrent}
                  locale={{
                    emptyText: (
                      <Empty
                        className={styles.empty}
                        description={
                          selectedObjectTypeId
                            ? objectMetricText("m522159fe536d")
                            : objectMetricText("m6be07467be0f")
                        }
                      />
                    ),
                  }}
                  pagination={false}
                  rowKey={(record) => `${record.definition.id}-${record.definition.version}`}
                  scroll={{ x: 980 }}
                />
              </div>
              {listCurrent && listTotal > 0 ? (
                <div className={styles.paginationBar}>
                  <TablePaginationBar
                    current={page}
                    onChange={(nextPage, nextPageSize) => {
                      setPage(nextPageSize === pageSize ? nextPage : 1);
                      setPageSize(nextPageSize);
                      if (tableViewportRef.current) tableViewportRef.current.scrollTop = 0;
                    }}
                    pageSize={pageSize}
                    showSizeChanger
                    showTotal={(total) => t("common.total", { total })}
                    total={listTotal}
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
