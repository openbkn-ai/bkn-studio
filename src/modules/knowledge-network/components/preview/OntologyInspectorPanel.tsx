/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** 本体图谱右侧检查面板 —— 未选中显示实体类图例，选中显示属性 / 绑定资源 / 关系。 */

import { CloseOutlined, DeploymentUnitOutlined } from "@ant-design/icons";
import { Spin, Tag } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { getKnowledgeNetworkObjectTypeDetail } from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  KnowledgeNetworkObjectTypeRecord,
  KnowledgeNetworkRelationTypeRecord,
  ObjectTypeDetail,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./OntologyInspectorPanel.module.css";

type OntologyInspectorPanelProps = {
  networkId: string;
  objectTypes: KnowledgeNetworkObjectTypeRecord[];
  relationTypes: KnowledgeNetworkRelationTypeRecord[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

export function OntologyInspectorPanel({
  networkId,
  objectTypes,
  relationTypes,
  selectedId,
  onSelect,
}: OntologyInspectorPanelProps) {
  const { t } = useTranslation();
  const entity = objectTypes.find((item) => item.id === selectedId) ?? null;

  const [detail, setDetail] = useState<ObjectTypeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetail(null);
    setDetailLoading(true);
    getKnowledgeNetworkObjectTypeDetail(networkId, selectedId)
      .then((result) => {
        if (!cancelled) {
          setDetail(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDetail(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDetailLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [networkId, selectedId]);

  if (!entity) {
    return (
      <div className={styles.empty}>
        <div className={styles.hint}>
          <DeploymentUnitOutlined />
          <span>{t("knowledgeNetwork.previewInspectorHint")}</span>
        </div>
        <div className={styles.legendTitle}>{t("knowledgeNetwork.previewEntityClasses")}</div>
        <div className={styles.legendList}>
          {objectTypes.map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.legendItem}
              onClick={() => onSelect(item.id)}
            >
              <span className={styles.dot} style={{ background: item.color || "#2e68ff" }} />
              <span className={styles.legendName}>{item.name}</span>
              {item.hasIndex ? <span className={styles.legendIndexed} /> : null}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const relations = relationTypes.filter(
    (relation) => relation.sourceObjectTypeId === entity.id || relation.targetObjectTypeId === entity.id,
  );

  return (
    <div className={styles.inspect}>
      <div className={styles.head}>
        <span className={styles.headDot} style={{ background: entity.color || "#2e68ff" }} />
        <div className={styles.headTitle}>
          <strong>{entity.name}</strong>
          <span>
            {entity.hasIndex
              ? t("knowledgeNetwork.previewIndexed")
              : t("knowledgeNetwork.previewNotIndexed")}
          </span>
        </div>
        <button
          type="button"
          className={styles.close}
          aria-label={t("common.cancel")}
          onClick={() => onSelect(null)}
        >
          <CloseOutlined />
        </button>
      </div>

      {entity.conceptGroupNames.length > 0 ? (
        <div className={styles.groups}>
          {entity.conceptGroupNames.map((group) => (
            <Tag key={group} bordered={false}>
              {group}
            </Tag>
          ))}
        </div>
      ) : null}

      <section className={styles.section}>
        <div className={styles.sectionTitle}>
          {t("knowledgeNetwork.previewProperties")}
          {detail ? <span>{detail.dataProperties.length}</span> : null}
        </div>
        {detailLoading ? (
          <div className={styles.loadingRow}>
            <Spin size="small" />
          </div>
        ) : detail && detail.dataProperties.length > 0 ? (
          detail.dataProperties.map((property) => (
            <div key={property.name} className={styles.propRow}>
              <code>
                {property.name}
                {property.primaryKey ? <span className={styles.pk}>PK</span> : null}
              </code>
              <span className={styles.propType}>{property.type}</span>
            </div>
          ))
        ) : (
          <div className={styles.muted}>{t("knowledgeNetwork.previewNoProps")}</div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>{t("knowledgeNetwork.previewBoundResource")}</div>
        {detail?.dataSource ? (
          <div className={styles.bindCard}>
            <span className={styles.bindName}>{detail.dataSource.name}</span>
            <Tag color={entity.hasIndex ? "success" : "default"} bordered={false}>
              {entity.hasIndex
                ? t("knowledgeNetwork.previewIndexed")
                : t("knowledgeNetwork.previewNotIndexed")}
            </Tag>
          </div>
        ) : (
          <div className={styles.bindNone}>{t("knowledgeNetwork.previewNoBind")}</div>
        )}
      </section>

      {relations.length > 0 ? (
        <section className={styles.section}>
          <div className={styles.sectionTitle}>
            {t("knowledgeNetwork.previewRelations")} <span>{relations.length}</span>
          </div>
          {relations.map((relation) => {
            const out = relation.sourceObjectTypeId === entity.id;
            const otherName = out ? relation.targetObjectTypeName : relation.sourceObjectTypeName;
            const otherId = out ? relation.targetObjectTypeId : relation.sourceObjectTypeId;
            const other = objectTypes.find((item) => item.id === otherId);
            return (
              <div key={relation.id} className={styles.relRow}>
                <span className={styles.relVerb}>{relation.name}</span>
                <span className={styles.relArrow}>{out ? "→" : "←"}</span>
                <span className={styles.relTarget}>
                  <span className={styles.dot} style={{ background: other?.color || "#999" }} />
                  {otherName}
                </span>
              </div>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
