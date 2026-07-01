/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Steps } from "antd";

import { useTranslation } from "react-i18next";

type CapabilityStatusStepperProps = {
  status: string;
  kind: string;
};

export function CapabilityStatusStepper({ status, kind }: CapabilityStatusStepperProps) {
  const { t } = useTranslation();

  const canDebug = kind === "http" || kind === "mcp" || kind === "function";
  const published = status === "published";
  const offline = status === "offline";

  let current = 0;
  if (published) {
    current = canDebug ? 2 : 1;
  } else if (offline) {
    current = canDebug ? 2 : 1;
  } else if (canDebug) {
    current = 0;
  }

  const steps = canDebug
    ? [
        { title: t("executionFactoryLab.stepDraft") },
        { title: t("executionFactoryLab.stepDebug") },
        { title: t("executionFactoryLab.stepPublish") },
      ]
    : [
        { title: t("executionFactoryLab.stepDraft") },
        { title: t("executionFactoryLab.stepPublish") },
      ];

  const hint =
    published && !offline
      ? t("executionFactoryLab.stepHintPublished")
      : offline
        ? t("executionFactoryLab.stepHintOffline")
        : canDebug
          ? t("executionFactoryLab.stepHintDraftDebug")
          : t("executionFactoryLab.stepHintDraftPublish");

  const hintStyle = published
    ? {
        background: "var(--color-success-bg)",
        border: "1px solid var(--color-success-border)",
        color: "var(--color-success-text)",
      }
    : offline
      ? {
          background: "var(--color-warning-bg)",
          border: "1px solid var(--color-warning-border)",
          color: "var(--color-warning-text)",
        }
      : {
          background: "var(--color-info-bg)",
          border: "1px solid var(--color-info-border)",
          color: "var(--color-info-text)",
        };

  return (
    <div style={{ marginBottom: 16 }}>
      <Steps current={current} items={steps} size="small" />
      <div
        style={{
          ...hintStyle,
          borderRadius: 8,
          fontSize: 14,
          lineHeight: 1.6,
          marginTop: 12,
          padding: "8px 12px",
        }}
      >
        {hint}
      </div>
    </div>
  );
}
