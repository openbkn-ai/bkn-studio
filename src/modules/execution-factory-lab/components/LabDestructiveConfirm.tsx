/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/* eslint-disable react-refresh/only-export-components */

import { Alert, Modal, Typography } from "antd";

import type { TFunction } from "i18next";

import { formatCapabilityStatusLabel } from "@/modules/execution-factory-lab/utils/capability-status";

export type LabDestructiveAction =
  | "delete"
  | "offline"
  | "republish"
  | "skillReplace"
  | "disableOrchestration";

export type LabDestructiveConfirmContext = {
  name: string;
  kind: string;
  status: string;
  version?: string;
  orchestrationEnabled?: boolean;
  targetVersion?: string;
};

function buildImpactLines(
  action: LabDestructiveAction,
  context: LabDestructiveConfirmContext,
  t: TFunction,
): string[] {
  const lines: string[] = [];
  const isPublished = context.status === "published";

  switch (action) {
    case "delete":
      lines.push(t("executionFactoryLab.destructiveDeleteImpactIrreversible"));
      if (isPublished) {
        lines.push(t("executionFactoryLab.destructiveDeleteImpactPublished"));
      } else {
        lines.push(t("executionFactoryLab.destructiveDeleteImpactDraft"));
      }
      break;
    case "offline":
      if (isPublished) {
        lines.push(t("executionFactoryLab.destructiveOfflineImpactPublished"));
      }
      lines.push(t("executionFactoryLab.destructiveOfflineImpactRecoverable"));
      break;
    case "republish":
      lines.push(
        t("executionFactoryLab.destructiveRepublishImpact", {
          version: context.targetVersion ?? context.version ?? "-",
        }),
      );
      if (isPublished) {
        lines.push(t("executionFactoryLab.destructiveRepublishImpactPublished"));
      }
      break;
    case "skillReplace":
      lines.push(t("executionFactoryLab.destructiveSkillReplaceImpact"));
      if (isPublished) {
        lines.push(t("executionFactoryLab.destructiveSkillReplaceImpactPublished"));
      }
      break;
    case "disableOrchestration":
      lines.push(t("executionFactoryLab.destructiveDisableOrchestrationImpact"));
      lines.push(t("executionFactoryLab.destructiveDisableOrchestrationRecoverable"));
      break;
    default:
      break;
  }

  if (context.orchestrationEnabled) {
    lines.push(t("executionFactoryLab.destructiveImpactOrchestration"));
  }

  return lines;
}

export function LabDestructiveImpactAlert({
  action,
  context,
  t,
}: {
  action: LabDestructiveAction;
  context: LabDestructiveConfirmContext;
  t: TFunction;
}) {
  const impactLines = buildImpactLines(action, context, t);
  const statusLabel = formatCapabilityStatusLabel(context.status, t);

  return (
    <div>
      <Alert
        description={
          <ul style={{ margin: 0, paddingInlineStart: 20 }}>
            {impactLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        }
        message={t("executionFactoryLab.destructiveWarningTitle")}
        showIcon
        style={{ marginBottom: 16 }}
        type="warning"
      />
      <Typography.Paragraph style={{ marginBottom: 0 }}>
        <Typography.Text strong>{t("executionFactoryLab.destructiveTargetLabel")}: </Typography.Text>
        {context.name}
      </Typography.Paragraph>
      <Typography.Paragraph style={{ marginBottom: 0 }} type="secondary">
        {t("executionFactoryLab.destructiveTargetMeta", {
          kind: context.kind.toUpperCase(),
          status: statusLabel,
          version: context.version ?? "-",
        })}
      </Typography.Paragraph>
    </div>
  );
}

export function openLabDestructiveConfirm(params: {
  action: LabDestructiveAction;
  context: LabDestructiveConfirmContext;
  title: string;
  okText: string;
  onOk: () => void | Promise<void>;
  t: TFunction;
}) {
  Modal.confirm({
    cancelText: params.t("common.cancel"),
    content: <LabDestructiveImpactAlert action={params.action} context={params.context} t={params.t} />,
    okButtonProps: { danger: true },
    okText: params.okText,
    onOk: params.onOk,
    title: params.title,
    width: 520,
  });
}
