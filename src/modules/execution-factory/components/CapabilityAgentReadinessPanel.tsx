/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { RobotOutlined } from "@ant-design/icons";
import { Alert, Progress, Tag } from "antd";
import { useTranslation } from "react-i18next";

import type {
  AgentInvokePolicy,
  AgentVisibility,
  CapabilityManifest,
  CapabilityRiskLevel,
  CapabilitySideEffect,
  CapabilityTestStatus,
} from "@/modules/execution-factory/types/capability-manifest";
import { getCapabilityReadiness } from "@/modules/execution-factory/utils/capability-manifest";

import styles from "./CapabilityAgentReadinessPanel.module.css";

type CapabilityAgentReadinessPanelProps = {
  manifest: CapabilityManifest;
};

const riskColorMap: Record<CapabilityRiskLevel, string> = {
  low: "green",
  medium: "gold",
  high: "red",
};

const visibilityColorMap: Record<AgentVisibility, string> = {
  hidden: "default",
  discoverable: "blue",
  callable: "green",
};

const invokePolicyColorMap: Record<AgentInvokePolicy, string> = {
  manual_only: "default",
  approval_required: "gold",
  auto_allowed: "green",
};

const testStatusColorMap: Record<CapabilityTestStatus, string> = {
  untested: "default",
  passed: "green",
  failed: "red",
  stale: "gold",
};

const sideEffectColorMap: Record<CapabilitySideEffect, string> = {
  none: "green",
  read: "blue",
  write: "gold",
  external_action: "red",
  unknown: "default",
};

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
  const testStatus = manifest.testStatus ?? "untested";
  const agentVisibility = manifest.agentVisibility ?? "hidden";
  const agentInvokePolicy = manifest.agentInvokePolicy ?? "manual_only";

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
          <div className={styles.scoreLabel}>
            {t("executionFactory.agentReadiness.score", {
              defaultValue: "就绪度",
            })}
          </div>
        </div>
      </div>

      <div className={styles.tags}>
        <Tag>{sourceTypeLabel(manifest.sourceType)}</Tag>
        <Tag color={testStatusColorMap[testStatus]}>
          {t(`executionFactory.agentReadiness.testStatus.${testStatus}`, {
            defaultValue: `验证：${testStatus}`,
          })}
        </Tag>
        <Tag color={sideEffectColorMap[sideEffects]}>
          {t(`executionFactory.agentReadiness.sideEffects.${sideEffects}`, {
            defaultValue: `副作用：${sideEffects}`,
          })}
        </Tag>
        <Tag color={riskColorMap[riskLevel]}>
          {t(`executionFactory.agentReadiness.risk.${riskLevel}`, {
            defaultValue: `风险：${riskLevel}`,
          })}
        </Tag>
        <Tag color={visibilityColorMap[agentVisibility]}>
          {t(`executionFactory.agentReadiness.visibility.${agentVisibility}`, {
            defaultValue: `Agent：${agentVisibility}`,
          })}
        </Tag>
        <Tag color={invokePolicyColorMap[agentInvokePolicy]}>
          {t(`executionFactory.agentReadiness.invokePolicy.${agentInvokePolicy}`, {
            defaultValue: `调用：${agentInvokePolicy}`,
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
                <Tag key={item}>{item}</Tag>
              ))}
            </div>
          }
          showIcon
          type="info"
        />
      ) : (
        <div className={styles.emptyText}>
          {t("executionFactory.agentReadiness.ready", {
            defaultValue: "语义、验证和调用策略已基本齐备，可作为 Agent 调用候选。",
          })}
        </div>
      )}
    </section>
  );
}

