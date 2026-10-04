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
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { ObjectMetricGraphCanvas } from "@/modules/knowledge-network/components/object-metric/ObjectMetricGraphCanvas";
import {
  filterObjectMetrics,
  resolveSelectedObjectTypeId,
} from "@/modules/knowledge-network/components/object-metric/object-metric-list-utils";
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

type Props = { canModify: boolean; networkId: string };

const typeNames: Record<ObjectMetricTypeV1, string> = {
  atomic: "原子指标",
  composite: "复合指标",
  derived: "衍生指标",
};
const statusNames = {
  deprecated: "已废弃",
  draft: "草稿",
  published: "已发布",
  validated: "已校验",
};

export function ObjectMetricListPanel({ canModify, networkId }: Props) {
  const navigate = useNavigate();
  const { message } = useAppServices();
  const [loading, setLoading] = useState(true);
  const [objectTypes, setObjectTypes] = useState<KnowledgeNetworkObjectTypeRecord[]>([]);
  const [relationTypes, setRelationTypes] = useState<KnowledgeNetworkRelationTypeRecord[]>([]);
  const [metrics, setMetrics] = useState<ObjectMetricRecordV1[]>([]);
  const [selectedObjectTypeId, setSelectedObjectTypeId] = useState("");
  const [keyword, setKeyword] = useState("");
  const [metricType, setMetricType] = useState<ObjectMetricTypeV1 | undefined>();
  const [viewMode, setViewMode] = useState<"graph" | "list">("graph");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [objects, relations, result] = await Promise.all([
        listKnowledgeNetworkObjectTypes(networkId),
        listKnowledgeNetworkRelationTypes(networkId),
        listObjectMetricsV1(networkId, { limit: 500 }),
      ]);
      setObjectTypes(objects);
      setRelationTypes(relations);
      setMetrics(result.entries);
      setSelectedObjectTypeId((current) =>
        resolveSelectedObjectTypeId(current, objects, result.entries),
      );
    } finally {
      setLoading(false);
    }
  }, [networkId]);

  useEffect(() => {
    void reload();
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
      title: "指标",
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
      title: "类型",
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
      title: "计算对象",
      width: 120,
      render: (_, record) =>
        record.definition.calculation_scope === "object_instance" ? "单个实例" : "实例集合",
    },
    {
      key: "status",
      title: "状态",
      width: 100,
      render: (_, record) => (
        <Tag color={record.definition.lifecycle.status === "published" ? "success" : "default"}>
          {statusNames[record.definition.lifecycle.status]}
        </Tag>
      ),
    },
    {
      key: "description",
      title: "业务定义",
      ellipsis: true,
      render: (_, record) => record.definition.description || "--",
    },
    {
      key: "actions",
      title: "操作",
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
            详情
          </Button>
          {canModify ? (
            <Tooltip
              title={
                ["published", "deprecated"].includes(record.definition.lifecycle.status)
                  ? "创建新草稿版本后编辑"
                  : "编辑当前草稿"
              }
            >
              <Button
                aria-label={`编辑指标 ${record.definition.name}`}
                icon={<EditOutlined />}
                onClick={() => void openEditor(record)}
                size="small"
                type="text"
              />
            </Tooltip>
          ) : null}
          {canModify && ["draft", "validated"].includes(record.definition.lifecycle.status) ? (
            <Button
              aria-label={`删除指标草稿 ${record.definition.name}`}
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                Modal.confirm({
                  content: `确定删除草稿“${record.definition.name}”吗？`,
                  okButtonProps: { danger: true },
                  onOk: async () => {
                    await deleteObjectMetricDraftV1(
                      networkId,
                      record.definition.id,
                      record.definition.version,
                    );
                    void message.success("草稿已删除");
                    await reload();
                  },
                  title: "删除草稿",
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
                  content: "废弃后新建指标不能再引用这个版本，已有固定版本依赖不受影响。",
                  okButtonProps: { danger: true },
                  onOk: async () => {
                    await deprecateObjectMetricV1(
                      networkId,
                      record.definition.id,
                      record.definition.version,
                    );
                    void message.success("指标版本已废弃");
                    await reload();
                  },
                  title: `废弃“${record.definition.name}”`,
                });
              }}
              size="small"
              type="link"
            >
              废弃
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
            onClick={() => setSelectedObjectTypeId(item.id)}
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
          <Input
            allowClear
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索对象类或指标"
            prefix={<SearchOutlined />}
            value={keyword}
          />
          {renderObjectGroup("已定义指标", objectsWithMetrics)}
          {renderObjectGroup("暂无指标", objectsWithoutMetrics)}
          {!objectTypes.length && !loading ? (
            <Empty description="暂无对象类" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : null}
        </aside>
        <div className={styles.content}>
          <div className={styles.toolbar}>
            <div className={styles.toolbarLeft}>
              <strong>{selectedObject?.name ?? "请选择对象类"}</strong>
              <span>{selectedObject?.id}</span>
            </div>
            <div className={styles.toolbarRight}>
              <Tooltip title="刷新对象类与指标数据">
                <Button
                  aria-label="刷新对象类与指标数据"
                  icon={<ReloadOutlined />}
                  loading={loading}
                  onClick={() => void reload()}
                />
              </Tooltip>
              <Segmented
                onChange={(value) => setViewMode(value as "graph" | "list")}
                options={[
                  { label: "图谱", value: "graph" },
                  { label: "列表", value: "list" },
                ]}
                value={viewMode}
              />
              <Select
                allowClear
                onChange={setMetricType}
                options={Object.entries(typeNames).map(([value, label]) => ({ label, value }))}
                placeholder="全部类型"
                value={metricType}
                style={{ width: 130 }}
              />
              {canModify ? (
                <Dropdown
                  menu={{
                    items: (["atomic", "derived", "composite"] as ObjectMetricTypeV1[]).map(
                      (type) => ({ key: type, label: `新建${typeNames[type]}` }),
                    ),
                    onClick: ({ key }) => openCreate(key as ObjectMetricTypeV1),
                  }}
                >
                  <Button disabled={!selectedObjectTypeId} icon={<PlusOutlined />} type="primary">
                    新建指标
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
              onSelectObject={setSelectedObjectTypeId}
              relationTypes={relationTypes}
              selectedObjectTypeId={selectedObjectTypeId}
            />
          ) : (
            <Table
              columns={columns}
              dataSource={visibleMetrics}
              loading={loading}
              locale={{
                emptyText: (
                  <Empty
                    className={styles.empty}
                    description={
                      selectedObjectTypeId
                        ? "当前对象类还没有指标，可从右上角新建。"
                        : "请选择对象类"
                    }
                  />
                ),
              }}
              pagination={false}
              rowKey={(record) => `${record.definition.id}-${record.definition.version}`}
              scroll={{ x: 980 }}
            />
          )}
        </div>
      </div>
    </section>
  );
}
