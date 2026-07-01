/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ProfileOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Tag } from "antd";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { renderResourceIcon } from "@/modules/knowledge-network/components/shared/ResourceIconSelect";
import { ActionTypeExecutionConfigTable } from "@/modules/knowledge-network/components/action-type/ActionTypeExecutionConfigTable";
import type {
  ActionTypeCondition,
  ActionTypeDetail,
  KnowledgeNetworkActionTypeKind,
  KnowledgeNetworkObjectTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ActionTypeOverviewPanel.module.css";

type ActionTypeOverviewPanelProps = {
  detail: ActionTypeDetail;
  networkId: string;
  objectTypes: KnowledgeNetworkObjectTypeRecord[];
};

function getActionKindLabel(
  actionKind: KnowledgeNetworkActionTypeKind,
  t: (key: string) => string,
) {
  switch (actionKind) {
    case "update":
      return t("knowledgeNetwork.actionTypeKindUpdate");
    case "delete":
      return t("knowledgeNetwork.actionTypeKindDelete");
    case "notify":
      return t("knowledgeNetwork.actionTypeKindNotify");
    case "create":
    default:
      return t("knowledgeNetwork.actionTypeKindCreate");
  }
}

function formatConditionLabel(
  condition: ActionTypeCondition | undefined,
  t: (key: string) => string,
) {
  if (!condition?.field || !condition.operation) {
    return t("knowledgeNetwork.actionTypeEmptyValue");
  }

  const operationLabel = t(
    `knowledgeNetwork.actionTypeConditionOperation_${condition.operation}`,
  );
  const valueLabel = Array.isArray(condition.value)
    ? condition.value.join(", ")
    : condition.value !== undefined && condition.value !== null
      ? String(condition.value)
      : "";

  if (condition.operation === "exist" || condition.operation === "not_exist") {
    return `${condition.field} ${operationLabel}`;
  }

  return valueLabel
    ? `${condition.field} ${operationLabel} ${valueLabel}`
    : `${condition.field} ${operationLabel}`;
}

function ObjectTypeCell({
  emptyLabel,
  objectType,
}: {
  emptyLabel: string;
  objectType?: KnowledgeNetworkObjectTypeRecord;
}) {
  if (!objectType) {
    return <span className={styles.emptyValue}>{emptyLabel}</span>;
  }

  return (
    <span className={styles.objectCell}>
      <span className={styles.objectIcon} style={{ backgroundColor: objectType.color }}>
        {renderResourceIcon(objectType.icon)}
      </span>
      <span>{objectType.name}</span>
    </span>
  );
}

export function ActionTypeOverviewPanel({
  detail,
  networkId,
  objectTypes,
}: ActionTypeOverviewPanelProps) {
  const { t } = useTranslation();

  const boundObjectType = useMemo(
    () => objectTypes.find((item) => item.id === detail.objectTypeId),
    [detail.objectTypeId, objectTypes],
  );
  const affectedObjectType = useMemo(
    () => objectTypes.find((item) => item.id === detail.affect?.objectTypeId),
    [detail.affect?.objectTypeId, objectTypes],
  );

  return (
    <div className={styles.page}>
      <section className={styles.summaryCard}>
        <div className={styles.summaryHead}>
          <span className={styles.objectIconSquare} style={{ backgroundColor: detail.color }}>
            <ThunderboltOutlined />
          </span>
          <div>
            <h2 className={styles.summaryTitle}>{detail.name}</h2>
            <p className={styles.summaryDescription}>
              {detail.description || t("knowledgeNetwork.noDescription")}
            </p>
          </div>
        </div>
        <div className={styles.tagRow}>
          {detail.tags.length > 0 ? (
            detail.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)
          ) : (
            <span className={styles.emptyValue}>{t("knowledgeNetwork.noTags")}</span>
          )}
        </div>
        <div className={styles.metaRow}>
          <span>{t("knowledgeNetwork.updatedBy", { name: detail.updaterName })}</span>
          <span>{detail.updateTime}</span>
        </div>
      </section>

      <section className={styles.sectionCard}>
        <h3>{t("knowledgeNetwork.actionTypeBasicInfo")}</h3>
        <div className={styles.infoGrid}>
          <div>
            <span>{t("knowledgeNetwork.actionTypeKind")}</span>
            <strong>{getActionKindLabel(detail.actionKind, t)}</strong>
          </div>
          <div>
            <span>ID</span>
            <strong>{detail.id}</strong>
          </div>
          <div>
            <span>{t("knowledgeNetwork.actionTypeTriggerCondition")}</span>
            <strong>{formatConditionLabel(detail.condition, t)}</strong>
          </div>
        </div>
      </section>

      <section className={styles.sectionCard}>
        <h3>{t("knowledgeNetwork.actionTypeBinding")}</h3>
        <div className={styles.infoGrid}>
          <div>
            <span>{t("knowledgeNetwork.actionTypeObject")}</span>
            <ObjectTypeCell
              emptyLabel={t("knowledgeNetwork.actionTypeEmptyValue")}
              objectType={boundObjectType}
            />
          </div>
          <div>
            <span>{t("knowledgeNetwork.actionTypeAffectedObject")}</span>
            <ObjectTypeCell
              emptyLabel={t("knowledgeNetwork.actionTypeEmptyValue")}
              objectType={affectedObjectType}
            />
          </div>
          <div className={styles.fullWidthItem}>
            <span>{t("knowledgeNetwork.actionTypeAffectDescription")}</span>
            <strong>{detail.affect?.comment || t("knowledgeNetwork.actionTypeEmptyValue")}</strong>
          </div>
        </div>
      </section>

      <section className={styles.sectionCard}>
        <h3>
          <ProfileOutlined /> {t("knowledgeNetwork.actionTypeExecutionItemMapping")}
        </h3>
        <ActionTypeExecutionConfigTable detail={detail} networkId={networkId} />
      </section>
    </div>
  );
}
