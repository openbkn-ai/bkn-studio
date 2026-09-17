/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useRef, useState } from "react";
import { Alert, Spin } from "antd";
import { useTranslation } from "react-i18next";
import { formatDateTime } from "@/framework/i18n/format";
import { EvidenceChainPanels } from "./EvidenceChainPanels";
import { BusinessProvenance016 } from "./BusinessProvenance016";
import { generateCurrentExplanation, readCurrentExplanation, type CurrentExplanation } from "./current-explanation.service";
import styles from "./CurrentExplanationPanel.module.css";

type ExplanationPanel = "timeline" | "evidence" | "execution";

export function CurrentExplanationPanel<TPanel extends ExplanationPanel = "timeline" | "evidence">({ interactionId, panel, onPanelChange }: { interactionId: string; panel?: TPanel; onPanelChange?: (panel: TPanel) => void }) {
  const { t } = useTranslation();
  const [value, setValue] = useState<CurrentExplanation>();
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  const [readAttempt, setReadAttempt] = useState(0);
  const request = useRef<symbol | undefined>(undefined);
  useEffect(() => {
    const token = Symbol(); request.current = token;
    setValue(undefined); setBusy(true); setFailed(false);
    void readCurrentExplanation(interactionId).then(result => { if (request.current === token) setValue(result); }).catch(() => { if (request.current === token) setFailed(true); }).finally(() => { if (request.current === token) setBusy(false); });
    return () => { request.current = undefined; };
  }, [interactionId, readAttempt]);
  const generate = async () => {
    const token = Symbol(); request.current = token;
    setBusy(true); setFailed(false);
    try { const result = await generateCurrentExplanation(interactionId); if (request.current === token) setValue(result); }
    catch { if (request.current === token) setFailed(true); }
    finally { if (request.current === token) setBusy(false); }
  };
  return <section className={styles.shell}>
    <header className={styles.metaBar}><div><p>{t("bknTrace.evidenceChain.current.basis")}</p>{value?.generatedAt && <small>{t("bknTrace.evidenceChain.current.generatedAt", { time: formatDateTime(value.generatedAt) })}</small>}</div><button type="button" className={styles.metaAction} disabled={busy} onClick={() => failed && !value ? setReadAttempt(attempt => attempt + 1) : void generate()}>{t(failed && !value ? "bknTrace.evidenceChain.current.retryRead" : value?.view ? "bknTrace.evidenceChain.current.refresh" : "bknTrace.evidenceChain.current.generate")}</button></header>
    {busy && <Spin />}
    {failed && <Alert type="error" showIcon message={t(failed && !value ? "bknTrace.evidenceChain.current.readFailed" : "bknTrace.evidenceChain.current.failed")} />}
    {!busy && !failed && value?.status === "not_generated" && <p>{t("bknTrace.evidenceChain.current.empty")}</p>}
    {value?.view && (value.view.questionPairs?.length
      ? <BusinessProvenance016 key={`${interactionId}:${value.generatedAt ?? ""}`} view={value.view} panel={panel === "timeline" ? "timeline" : "evidence"} evidenceOnly={panel === "evidence" && !onPanelChange} onPanelChange={onPanelChange ? next => onPanelChange(next as TPanel) : undefined} />
      : <EvidenceChainPanels key={`${interactionId}:${value.generatedAt ?? ""}`} view={value.view} initialPanel={panel === "execution" ? "execution" : "evidence"} panel={panel === "execution" ? "execution" : "evidence"} onPanelChange={next => onPanelChange?.(next as TPanel)} />)}
  </section>;
}
