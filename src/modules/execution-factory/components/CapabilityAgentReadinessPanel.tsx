/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { QuestionCircleOutlined, RobotOutlined } from "@ant-design/icons";
import { Alert, Progress, Tag, Tooltip } from "antd";
import { useTranslation } from "react-i18next";

import type { CapabilityManifest } from "@/modules/execution-factory/types/capability-manifest";
import { getCapabilityReadiness } from "@/modules/execution-factory/utils/capability-manifest";

import styles from "./CapabilityAgentReadinessPanel.module.css";

type CapabilityAgentReadinessPanelProps = {
  manifest: CapabilityManifest;
};

const READINESS_DIMENSIONS: Array<{ key: string; label: string; weight: number }> = [
  { key: "business intent", label: "业务用途", weight: 40 },
  { key: "input semantics", label: "输入语义", weight: 35 },
  { key: "output semantics", label: "输出语义", weight: 25 },
];

function readinessDimensionLabel(key: string) {
  return READINESS_DIMENSIONS.find((dim) => dim.key === key)?.label ?? key;
}

function sourceTypeLabel(sourceType: CapabilityManifest["sourceType"]) {
  switch (sourceType) {
    case "tool":
      return "Tool";
    case "mcp":
      return "MCP Tool";
    case "skill":
      return "Skill";
    case "operator":
      return "Operator";
    default:
      return sourceType;
  }
}

export function CapabilityAgentReadinessPanel({
  manifest,
}: CapabilityAgentReadinessPanelProps) {
  const { t } = useTranslation();
  const readiness = getCapabilityReadiness(manifest);

  const sideEffects = manifest.sideEffects ?? "unknown";
  const riskLevel = manifest.riskLevel ?? "medium";
  const agentVisibility = manifest.agentVisibility ?? "hidden";

  return (
    <section className={styles.panel} data-testid="capability-agent-readiness">
      <div className={styles.header}>
        <div className={styles.titleWrap}>
          <div className={styles.title}>
            <RobotOutlined />
            {t("executionFactory.agentReadiness.title", {
              defaultValue: "Agent 可用性",
            })}
          </div>
          <div className={styles.description}>
            {manifest.intent ||
              manifest.description ||
              t("executionFactory.agentReadiness.emptyIntent", {
                defaultValue: "暂未补充业务用途，Agent 只能基于名称和技术 schema 推断使用方式。",
              })}
          </div>
        </div>
        <div className={styles.score}>
          <Progress
            percent={readiness.score}
            showInfo={false}
            size="small"
            status={readiness.level === "low" ? "exception" : "normal"}
          />
          <div className={styles.scoreValue}>{readiness.score}</div>
          <Tooltip
            title={
              <div className={styles.scoreRuleTip}>
                <div className={styles.scoreRuleTitle}>
                  {t("executionFactory.agentReadiness.scoreRuleTitle", {
                    defaultValue: "就绪度评分规则",
                  })}
                </div>
                {READINESS_DIMENSIONS.map((dim) => {
                  const met = !readiness.missing.includes(dim.key);
                  return (
                    <div
                      className={
                        met
                          ? styles.scoreRuleRow
                          : `${styles.scoreRuleRow} ${styles.scoreRuleRowMuted}`
                      }
                      key={dim.key}
                    >
                      <span>{`${met ? "✓" : "○"} ${dim.label}`}</span>
                      <span>{dim.weight}</span>
                    </div>
                  );
                })}
              </div>
            }
          >
            <span className={styles.scoreLabel}>
              {t("executionFactory.agentReadiness.score", {
                defaultValue: "就绪度",
              })}
              <QuestionCircleOutlined className={styles.scoreInfoIcon} />
            </span>
          </Tooltip>
        </div>
      </div>

      <div className={styles.tags}>
        <Tag>{sourceTypeLabel(manifest.sourceType)}</Tag>
        <Tag>
          {t(`executionFactory.agentReadiness.sideEffects.${sideEffects}`, {
            defaultValue: `副作用：${sideEffects}`,
          })}
        </Tag>
        <Tag>
          {t(`executionFactory.agentReadiness.risk.${riskLevel}`, {
            defaultValue: `风险：${riskLevel}`,
          })}
        </Tag>
        <Tag>
          {t(`executionFactory.agentReadiness.visibility.${agentVisibility}`, {
            defaultValue: `Agent：${agentVisibility}`,
          })}
        </Tag>
        <Tag>
          {t("executionFactory.agentReadiness.inputCount", {
            count: manifest.inputSemantics?.length ?? 0,
            defaultValue: `输入：${manifest.inputSemantics?.length ?? 0}`,
          })}
        </Tag>
        <Tag>
          {t("executionFactory.agentReadiness.outputCount", {
            count: manifest.outputSemantics?.length ?? 0,
            defaultValue: `输出：${manifest.outputSemantics?.length ?? 0}`,
          })}
        </Tag>
      </div>

      {readiness.missing.length > 0 ? (
        <Alert
          message={t("executionFactory.agentReadiness.missingTitle", {
            defaultValue: "建议补齐后再开放给 Agent 自动调用",
          })}
          description={
            <div className={styles.missingList}>
              {readiness.missing.map((item) => (
                <Tag key={item}>{readinessDimensionLabel(item)}</Tag>
              ))}
            </div>
          }
          showIcon
          type="info"
        />
      ) : (
        <div className={styles.emptyText}>
          {t("executionFactory.agentReadiness.ready", {
            defaultValue: "业务用途与输入输出语义已基本齐备，Agent 可据此理解调用方式。",
          })}
        </div>
      )}
    </section>
  );
}

