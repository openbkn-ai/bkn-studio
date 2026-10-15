/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  DeleteOutlined,
  EditOutlined,
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
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from "antd";
import type { TableProps } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { ObjectMetricGraphCanvas } from "@/modules/knowledge-network/components/object-metric/ObjectMetricGraphCanvas";
import {
  filterObjectMetrics,
  resolveSelectedObjectTypeId,
} from "@/modules/knowledge-network/components/object-metric/object-metric-list-utils";
import { usePersistentPageSize } from "@/modules/knowledge-network/components/shared/usePersistentPageSize";
import {
  createNextObjectMetricDraftV1,
  deleteObjectMetricDraftV1,
  deprecateObjectMetricV1,
  listKnowledgeNetworkObjectTypes,
  listKnowledgeNetworkRelationTypes,
  listObjectMetricsV1,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  ObjectMetricRecordV1,
  ObjectMetricTypeV1,
} from "@/modules/knowledge-network/types/object-metric";
import type {
  KnowledgeNetworkObjectTypeRecord,
  KnowledgeNetworkRelationTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ObjectMetricListPanel.module.css";
import { objectMetricText } from "@/modules/knowledge-network/lib/object-metric-text";
import { useTranslation } from "react-i18next";

type Props = { canModify: boolean; networkId: string };

const PAGE_SIZE_STORAGE_SCOPE = "object-metrics";
const GRAPH_METRIC_PAGE_SIZE = 500;

async function listAllObjectMetrics(networkId: string): Promise<ObjectMetricRecordV1[]> {
  const records: ObjectMetricRecordV1[] = [];
  while (true) {
    const page = await listObjectMetricsV1(networkId, {
      limit: GRAPH_METRIC_PAGE_SIZE,
      offset: records.length,
    });
    records.push(...page.entries);
    if (page.entries.length === 0 || records.length >= page.total_count) {
      return records;
    }
  }
}

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
  const [relationTypes, setRelationTypes] = useState<KnowledgeNetworkRelationTypeRecord[]>([]);
  const [metrics, setMetrics] = useState<ObjectMetricRecordV1[]>([]);
  const [listMetrics, setListMetrics] = useState<ObjectMetricRecordV1[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [selectedObjectTypeId, setSelectedObjectTypeId] = useState("");
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [metricType, setMetricType] = useState<ObjectMetricTypeV1 | undefined>();
  const [viewMode, setViewMode] = useState<"graph" | "list">("graph");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentPageSize(PAGE_SIZE_STORAGE_SCOPE, 10);
  const [listRefreshVersion, setListRefreshVersion] = useState(0);
  const tableViewportRef = useRef<HTMLDivElement>(null);
  const objectListRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [objects, relations, metricRecords] = await Promise.all([
        listKnowledgeNetworkObjectTypes(networkId),
        listKnowledgeNetworkRelationTypes(networkId),
        listAllObjectMetrics(networkId),
      ]);
      setObjectTypes(objects);
      setRelationTypes(relations);
      setMetrics(metricRecords);
      setSelectedObjectTypeId((current) =>
        resolveSelectedObjectTypeId(current, objects, metricRecords),
      );
    } finally {
      setLoading(false);
    }
  }, [networkId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(keyword.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    if (viewMode !== "list") {
      return;
    }

    let cancelled = false;
    setListLoading(true);
    void listObjectMetricsV1(networkId, {
      keyword: debouncedKeyword || undefined,
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
      })
      .catch(() => {
        if (!cancelled) {
          setListMetrics([]);
          setListTotal(0);
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
    debouncedKeyword,
    listRefreshVersion,
    metricType,
    networkId,
    page,
    pageSize,
    selectedObjectTypeId,
    viewMode,
  ]);

  const refresh = useCallback(async () => {
    setListRefreshVersion((current) => current + 1);
    await reload();
  }, [reload]);

  const metricCounts = useMemo(() => {
    const counts = new Map<string, number>();
    metrics.forEach((record) =>
      counts.set(
        record.definition.owner_object_type_id,
        (counts.get(record.definition.owner_object_type_id) ?? 0) + 1,
      ),
    );
    return counts;
  }, [metrics]);
  const normalizedKeyword = keyword.trim().toLowerCase();
  const matchingObjectTypeIds = new Set(
    metrics
      .filter(
        (record) =>
          !normalizedKeyword ||
          record.definition.name.toLowerCase().includes(normalizedKeyword) ||
          record.definition.code.toLowerCase().includes(normalizedKeyword),
      )
      .map((record) => record.definition.owner_object_type_id),
  );
  const visibleObjectTypes = objectTypes.filter(
    (item) =>
      !normalizedKeyword ||
      item.name.toLowerCase().includes(normalizedKeyword) ||
      item.id.toLowerCase().includes(normalizedKeyword) ||
      matchingObjectTypeIds.has(item.id),
  );
  const objectsWithMetrics = visibleObjectTypes.filter(
    (item) => (metricCounts.get(item.id) ?? 0) > 0,
  );
  const objectsWithoutMetrics = visibleObjectTypes.filter((item) => !metricCounts.get(item.id));
  const selectedObject = objectTypes.find((item) => item.id === selectedObjectTypeId);
  const visibleMetrics = filterObjectMetrics(
    metrics,
    selectedObjectTypeId,
    metricType,
    normalizedKeyword,
  );

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
          <strong>{record.definition.name}</strong>
          <span>
            {record.definition.code}@v{record.definition.version}
          </span>
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
                    await refresh();
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
                    await refresh();
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

  const renderObjectGroup = (title: string, entries: KnowledgeNetworkObjectTypeRecord[]) =>
    entries.length ? (
      <>
        <div className={styles.groupTitle}>{title}</div>
        {entries.map((item) => (
          <Button
            className={`${styles.objectButton} ${selectedObjectTypeId === item.id ? styles.selected : ""}`}
            key={item.id}
            onClick={() => {
              setSelectedObjectTypeId(item.id);
              setPage(1);
            }}
            type="text"
          >
            <span>{item.name}</span>
            <span>{metricCounts.get(item.id) ?? 0}</span>
          </Button>
        ))}
      </>
    ) : null;

  return (
    <section className={styles.page}>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarSearch}>
            <Input
              allowClear
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(1);
                if (objectListRef.current) {
                  objectListRef.current.scrollTop = 0;
                }
              }}
              placeholder={objectMetricText("m3719f5de9935")}
              prefix={<SearchOutlined />}
              value={keyword}
            />
          </div>
          <div className={styles.objectList} ref={objectListRef}>
            {renderObjectGroup(objectMetricText("mc2204ec9b74b"), objectsWithMetrics)}
            {renderObjectGroup(objectMetricText("meffa57b0d294"), objectsWithoutMetrics)}
            {!objectTypes.length && !loading ? (
              <Empty
                description={objectMetricText("mc90d408577d0")}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : null}
          </div>
        </aside>
        <div className={`${styles.content} ${viewMode === "list" ? styles.listContent : ""}`}>
          <div className={styles.toolbar}>
            <div className={styles.toolbarLeft}>
              <strong>{selectedObject?.name ?? objectMetricText("m6be07467be0f")}</strong>
              <span>{selectedObject?.id}</span>
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
              <Segmented
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
              metrics={visibleMetrics}
              objectTypes={objectTypes}
              onOpenMetric={(id) =>
                void navigate(`/knowledge-network/workspace/${networkId}/metrics/${id}/detail`)
              }
              onSelectObject={(objectTypeId) => {
                setSelectedObjectTypeId(objectTypeId);
                setPage(1);
              }}
              relationTypes={relationTypes}
              selectedObjectTypeId={selectedObjectTypeId}
            />
          ) : (
            <div className={styles.listView}>
              <div className={styles.tableViewport} ref={tableViewportRef}>
                <Table
                  columns={columns}
                  dataSource={listMetrics}
                  loading={listLoading}
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
              {listTotal > 0 ? (
                <div className={styles.paginationBar}>
                  <TablePaginationBar
                    current={page}
                    onChange={(nextPage, nextPageSize) => {
                      setPage(nextPageSize === pageSize ? nextPage : 1);
                      setPageSize(nextPageSize);
                      tableViewportRef.current?.scrollIntoView?.({ block: "start" });
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
