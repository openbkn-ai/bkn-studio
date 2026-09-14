/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

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
  canResolveActionSource: boolean;
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
  canResolveActionSource,
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
  const actionKindLabel = getActionKindLabel(detail.actionKind, t);
  const conditionLabel = formatConditionLabel(detail.condition, t);
  return (
    <div className={styles.page}>
      <div className={styles.overviewGrid}>
        <section className={`${styles.panel} ${styles.basicPanel}`}>
          <h2>{t("knowledgeNetwork.actionTypeBasicInfo")}</h2>
          <div className={styles.basicContent}>
            <div className={styles.basicFields}>
              <div>
                <span>ID</span>
                <strong>{detail.id}</strong>
              </div>
              <div>
                <span>{t("common.tag")}</span>
                <div className={styles.tagRow}>
                  {detail.tags.length > 0 ? (
                    detail.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)
                  ) : (
                    <span className={styles.emptyValue}>{t("knowledgeNetwork.noTags")}</span>
                  )}
                </div>
              </div>
              <div>
                <span>{t("knowledgeNetwork.color")}</span>
                <span className={styles.colorValue}>
                  <i style={{ backgroundColor: detail.color }} />
                  {detail.color}
                </span>
              </div>
              <div className={styles.basicDescription}>
                <span>{t("knowledgeNetwork.descriptionField")}</span>
                <strong>{detail.description || t("knowledgeNetwork.noDescription")}</strong>
              </div>
            </div>
            <div className={styles.auditBar}>
              <div>
                <span>{t("knowledgeNetwork.actionTypeUpdater")}</span>
                <strong>{detail.updaterName || t("knowledgeNetwork.actionTypeEmptyValue")}</strong>
              </div>
              <div>
                <span>{t("knowledgeNetwork.actionTypeUpdateTime")}</span>
                <strong>{detail.updateTime}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.rulePanel}`}>
          <h2>{t("knowledgeNetwork.actionTypeRuleConfig")}</h2>
          <div className={styles.ruleList}>
          <section className={styles.ruleSection}>
            <div className={styles.ruleHeading}>
              <span>1</span>
              <h4>{t("knowledgeNetwork.actionTypeTriggerRule")}</h4>
            </div>
            <div className={styles.infoGrid}>
              <div>
                <span>{t("knowledgeNetwork.actionTypeObject")}</span>
                <ObjectTypeCell
                  emptyLabel={t("knowledgeNetwork.actionTypeEmptyValue")}
                  objectType={boundObjectType}
                />
              </div>
              <div>
                <span>{t("knowledgeNetwork.actionTypeKind")}</span>
                <strong>{actionKindLabel}</strong>
              </div>
              <div className={styles.fullWidthItem}>
                <span>{t("knowledgeNetwork.actionTypeTriggerCondition")}</span>
                <strong>{conditionLabel}</strong>
              </div>
            </div>
          </section>

          <section className={styles.ruleSection}>
            <div className={styles.ruleHeading}>
              <span>2</span>
              <h4>{t("knowledgeNetwork.actionTypeExecutionTool")}</h4>
            </div>
            <ActionTypeExecutionConfigTable
              canResolveActionSource={canResolveActionSource}
              detail={detail}
              networkId={networkId}
            />
          </section>

          <section className={styles.ruleSection}>
            <div className={styles.ruleHeading}>
              <span>3</span>
              <h4>{t("knowledgeNetwork.actionTypeImpactDeclaration")}</h4>
            </div>
            <div className={styles.infoGrid}>
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
          </div>
        </section>
      </div>
    </div>
  );
}
