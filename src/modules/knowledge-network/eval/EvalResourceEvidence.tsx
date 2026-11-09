/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Button, Collapse, Empty, Spin, Tag } from "antd";
import { useEffect, useState } from "react";
import { EvalEvidenceContent } from "./EvalEvidenceContent";
import { getM0Evidence, type M0CaseDetail } from "./m0-run.service";
import { useEvalTranslation } from "./useEvalTranslation";

type Kind = "operation" | "receipt" | "interaction";

function EvidenceRecord({ kind, id }: { kind: Kind; id: string }) {
  const { t } = useEvalTranslation();
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ loading: boolean; failed?: boolean; data?: unknown }>({
    loading: true,
  });
  useEffect(() => {
    let active = true;
    setState({ loading: true });
    void getM0Evidence(kind, id)
      .then((data) => {
        if (active) setState({ loading: false, data });
      })
      .catch(() => {
        if (active) setState({ loading: false, failed: true });
      });
    return () => {
      active = false;
    };
  }, [kind, id, retry]);
  if (state.loading) return <Spin size="small" />;
  if (state.failed)
    return (
      <Alert
        type="error"
        showIcon
        message={t("knowledgeNetwork.eval.resourceOverview.evidenceFailed")}
        action={
          <Button onClick={() => setRetry((n) => n + 1)}>
            {t("knowledgeNetwork.eval.resultUi.evidenceRetry")}
          </Button>
        }
      />
    );
  return <EvalEvidenceContent id={kind} content={state.data} />;
}

export function EvalResourceEvidence({ detail }: { detail: M0CaseDetail }) {
  const { t } = useEvalTranslation();
  const refs = detail.evidence_refs;
  const entries = (
    [
      ["operation", refs?.operation_id, "operationRecord"],
      ["receipt", refs?.receipt_id, "receiptRecord"],
      ["interaction", refs?.interaction_id, "interactionRecord"],
    ] as const
  ).filter((entry) => entry[1]);
  return (
    <>
      <Tag color={detail.observation?.evidence_status === "complete" ? "success" : "warning"}>
        {t(
          `knowledgeNetwork.eval.resultUi.${detail.observation?.evidence_status === "complete" ? "evidenceComplete" : "evidenceIncomplete"}`,
        )}
      </Tag>
      {entries.length ? (
        <Collapse
          accordion
          destroyOnHidden
          items={entries.map(([kind, id, label]) => ({
            key: kind,
            label: t(`knowledgeNetwork.eval.resultUi.${label}`),
            children: <EvidenceRecord kind={kind} id={id!} />,
          }))}
        />
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("knowledgeNetwork.eval.resultUi.evidenceUnavailable")}
        />
      )}
    </>
  );
}
