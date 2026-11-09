/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Typography } from "antd";
import type { ReactNode } from "react";
import { EvalRunMaterials } from "./EvalRunMaterials";
import { EvalEvidenceContent } from "./EvalEvidenceContent";
import { useEvalTranslation } from "./useEvalTranslation";
import type { M0CaseDetail, M0Run, EvalSuiteCaseDetail } from "./m0-run.service";
import styles from "./EvalExecutionDetails.module.css";

type Props = {
  detail: M0CaseDetail;
  run?: M0Run;
  runId?: string;
  definition?: EvalSuiteCaseDetail;
  loading?: boolean;
  failed?: boolean;
  onRetry: () => void;
  target: string;
  tool?: string;
  children?: ReactNode;
};
export function EvalExecutionDetails({ target, tool, children, ...materials }: Props) {
  const { t } = useEvalTranslation();
  const text = (key: string) => t(`knowledgeNetwork.eval.executionUi.${key}`);
  const detail = materials.detail;
  return (
    <div className={styles.details}>
      <section aria-label={text("overview")}>
        <Typography.Title level={5}>{text("overview")}</Typography.Title>
        <dl className={styles.overview}>
          <div>
            <dt>{text("target")}</dt>
            <dd title={target}>{target}</dd>
          </div>
          <div>
            <dt>{text("tool")}</dt>
            <dd title={tool}>{tool || text("unrecorded")}</dd>
          </div>
          <div>
            <dt>{text("duration")}</dt>
            <dd>
              {detail.duration_ms == null
                ? text("unrecorded")
                : t("knowledgeNetwork.eval.executionUi.durationValue", {
                    count: detail.duration_ms,
                  })}
            </dd>
          </div>
        </dl>
      </section>
      {children || (
        <section className={styles.fallback} aria-label={text("recordedIO")}>
          <Typography.Title level={5}>{text("recordedIO")}</Typography.Title>
          <Typography.Paragraph type="secondary">{text("recordedIOHelp")}</Typography.Paragraph>
          {detail.input_spec && (
            <>
              <Typography.Text strong>{text("evaluationInput")}</Typography.Text>
              <EvalEvidenceContent id="input" content={detail.input_spec} />
            </>
          )}
          {detail.observation && (
            <>
              <Typography.Text strong>{text("evaluationOutput")}</Typography.Text>
              <EvalEvidenceContent id="observation" content={detail.observation} />
            </>
          )}
        </section>
      )}
      <EvalRunMaterials {...materials} />
    </div>
  );
}
