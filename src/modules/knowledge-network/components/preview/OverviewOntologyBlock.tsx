/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * 概述页本体区块 —— 一次拉取实体类 / 关系类（含明细），渲染本体图谱 +
 * 本体结构 / 数据绑定 表格。所有取数集中在此，避免重复请求。
 */

import { Spin, Table, Tabs, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { OntologyGraphCard } from "@/modules/knowledge-network/components/preview/OntologyGraphCard";
import {
  getKnowledgeNetworkObjectTypeDetail,
  listKnowledgeNetworkObjectTypes,
  listKnowledgeNetworkRelationTypes,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  KnowledgeNetworkObjectTypeRecord,
  KnowledgeNetworkRelationTypeRecord,
  ObjectTypeDetail,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./OverviewOntologyBlock.module.css";

type OverviewOntologyBlockProps = {
  networkId: string;
};

const DEFAULT_COLOR = "#2e68ff";

export function OverviewOntologyBlock({ networkId }: OverviewOntologyBlockProps) {
  const { t } = useTranslation();

  const [objectTypes, setObjectTypes] = useState<KnowledgeNetworkObjectTypeRecord[]>([]);
  const [relationTypes, setRelationTypes] = useState<KnowledgeNetworkRelationTypeRecord[]>([]);
  const [detailById, setDetailById] = useState<Record<string, ObjectTypeDetail | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDetailById({});

    (async () => {
      try {
        const [objects, relations] = await Promise.all([
          listKnowledgeNetworkObjectTypes(networkId),
          listKnowledgeNetworkRelationTypes(networkId),
        ]);
        if (cancelled) {
          return;
        }
        setObjectTypes(objects);
        setRelationTypes(relations);

        const details = await Promise.all(
          objects.map((item) =>
            getKnowledgeNetworkObjectTypeDetail(networkId, item.id).catch(() => null),
          ),
        );
        if (cancelled) {
          return;
        }
        const map: Record<string, ObjectTypeDetail | null> = {};
        objects.forEach((item, index) => {
          map[item.id] = details[index] ?? null;
        });
        setDetailById(map);
      } catch {
        if (!cancelled) {
          setObjectTypes([]);
          setRelationTypes([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [networkId]);

  const hubIds = useMemo(() => {
    const degree = new Map<string, number>();
    objectTypes.forEach((item) => degree.set(item.id, 0));
    relationTypes.forEach((relation) => {
      degree.set(relation.sourceObjectTypeId, (degree.get(relation.sourceObjectTypeId) ?? 0) + 1);
      degree.set(relation.targetObjectTypeId, (degree.get(relation.targetObjectTypeId) ?? 0) + 1);
    });
    const max = Math.max(0, ...degree.values());
    const set = new Set<string>();
    if (max > 0) {
      degree.forEach((value, id) => {
        if (value === max) {
          set.add(id);
        }
      });
    }
    return set;
  }, [objectTypes, relationTypes]);

  const colorById = useMemo(
    () => new Map(objectTypes.map((item) => [item.id, item.color || DEFAULT_COLOR])),
    [objectTypes],
  );

  const entityColumns: ColumnsType<KnowledgeNetworkObjectTypeRecord> = [
    {
      title: t("knowledgeNetwork.previewEntityClasses"),
      key: "name",
      render: (_, entity) => (
        <span className={styles.tblName}>
          <span className={styles.dot} style={{ background: entity.color || DEFAULT_COLOR }} />
          <span>{entity.name}</span>
          {hubIds.has(entity.id) ? <span className={styles.hubTag}>{t("knowledgeNetwork.previewHub")}</span> : null}
        </span>
      ),
    },
    {
      title: t("knowledgeNetwork.previewColProps"),
      key: "props",
      width: 80,
      render: (_, entity) => {
        const detail = detailById[entity.id];
        return detail ? detail.dataProperties.length : <span className={styles.muted}>—</span>;
      },
    },
    {
      title: t("knowledgeNetwork.previewColIndex"),
      key: "index",
      width: 110,
      render: (_, entity) =>
        entity.hasIndex ? (
          <Tag color="success" bordered={false}>
            {t("knowledgeNetwork.previewIndexed")}
          </Tag>
        ) : (
          <span className={styles.muted}>{t("knowledgeNetwork.previewNotIndexed")}</span>
        ),
    },
    {
      title: t("knowledgeNetwork.previewColConceptGroups"),
      key: "groups",
      render: (_, entity) =>
        entity.conceptGroupNames.length > 0 ? (
          entity.conceptGroupNames.map((group) => (
            <Tag key={group} bordered={false}>
              {group}
            </Tag>
          ))
        ) : (
          <span className={styles.muted}>—</span>
        ),
    },
  ];

  const relationColumns: ColumnsType<KnowledgeNetworkRelationTypeRecord> = [
    {
      title: t("knowledgeNetwork.previewColRelation"),
      key: "name",
      render: (_, relation) => relation.name,
    },
    {
      title: t("knowledgeNetwork.previewColPath"),
      key: "path",
      render: (_, relation) => (
        <span className={styles.relPath}>
          <span
            className={styles.chip}
            style={{ "--nc": colorById.get(relation.sourceObjectTypeId) ?? "#999" } as CSSProperties}
          >
            {relation.sourceObjectTypeName}
          </span>
          <span className={styles.relArrow}>→</span>
          <span
            className={styles.chip}
            style={{ "--nc": colorById.get(relation.targetObjectTypeId) ?? "#999" } as CSSProperties}
          >
            {relation.targetObjectTypeName}
          </span>
        </span>
      ),
    },
    {
      title: t("knowledgeNetwork.previewColMapping"),
      key: "mapping",
      width: 110,
      render: (_, relation) => (
        <Tag bordered={false}>
          {relation.mappingMode === "resource"
            ? t("knowledgeNetwork.previewMappingResource")
            : t("knowledgeNetwork.previewMappingDirect")}
        </Tag>
      ),
    },
  ];

  const bindingColumns: ColumnsType<KnowledgeNetworkObjectTypeRecord> = [
    {
      title: t("knowledgeNetwork.previewEntityClasses"),
      key: "name",
      render: (_, entity) => (
        <span className={styles.tblName}>
          <span className={styles.dot} style={{ background: entity.color || DEFAULT_COLOR }} />
          <span>{entity.name}</span>
        </span>
      ),
    },
    {
      title: t("knowledgeNetwork.previewColBoundResource"),
      key: "resource",
      render: (_, entity) => {
        const detail = detailById[entity.id];
        return detail?.dataSource ? (
          <span className={styles.resourceName}>{detail.dataSource.name}</span>
        ) : (
          <span className={styles.muted}>{t("knowledgeNetwork.previewUnbound")}</span>
        );
      },
    },
    {
      title: t("knowledgeNetwork.previewColIndexState"),
      key: "indexState",
      width: 120,
      render: (_, entity) =>
        entity.hasIndex ? (
          <Tag color="success" bordered={false}>
            {t("knowledgeNetwork.previewIndexed")}
          </Tag>
        ) : (
          <Tag bordered={false}>{t("knowledgeNetwork.previewNotIndexed")}</Tag>
        ),
    },
  ];

  return (
    <div className={styles.block}>
      <OntologyGraphCard
        networkId={networkId}
        objectTypes={objectTypes}
        relationTypes={relationTypes}
      />

      {objectTypes.length > 0 || loading ? (
        <Spin spinning={loading}>
          <Tabs
            className={styles.tabs}
            defaultActiveKey="ontology"
            items={[
              {
                key: "ontology",
                label: t("knowledgeNetwork.previewTabOntology"),
                children: (
                  <div className={styles.sectionGrid}>
                    <div className={styles.sectionCard}>
                      <div className={styles.sectionCardTitle}>
                        {t("knowledgeNetwork.previewEntityClasses")}
                        <span className={styles.badge}>{objectTypes.length}</span>
                      </div>
                      <Table
                        rowKey="id"
                        size="small"
                        columns={entityColumns}
                        dataSource={objectTypes}
                        pagination={false}
                      />
                    </div>
                    <div className={styles.sectionCard}>
                      <div className={styles.sectionCardTitle}>
                        {t("knowledgeNetwork.previewRelationClasses")}
                        <span className={styles.badge}>{relationTypes.length}</span>
                      </div>
                      <Table
                        rowKey="id"
                        size="small"
                        columns={relationColumns}
                        dataSource={relationTypes}
                        pagination={false}
                      />
                    </div>
                  </div>
                ),
              },
              {
                key: "binding",
                label: t("knowledgeNetwork.previewTabBinding"),
                children: (
                  <div className={styles.sectionCard}>
                    <div className={styles.sectionCardTitle}>
                      {t("knowledgeNetwork.previewColBoundResource")}
                    </div>
                    <Table
                      rowKey="id"
                      size="small"
                      columns={bindingColumns}
                      dataSource={objectTypes}
                      pagination={false}
                    />
                  </div>
                ),
              },
            ]}
          />
        </Spin>
      ) : null}
    </div>
  );
}
