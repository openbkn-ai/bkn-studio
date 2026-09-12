/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Spin } from "antd";
import { useTranslation } from "react-i18next";
import { formatDateTime } from "@/framework/i18n/format";
import { EvidenceChainPanels } from "./EvidenceChainPanels";
import { generateCurrentExplanation, readCurrentExplanation, type CurrentExplanation } from "./current-explanation.service";

export function CurrentExplanationPanel({ interactionId, panel, onPanelChange }: { interactionId: string; panel?: "evidence" | "execution"; onPanelChange?: (panel: "evidence" | "execution") => void }) {
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
  return <section>
    <p>{t("bknTrace.evidenceChain.current.basis")}</p>
    <Button loading={busy} onClick={() => failed && !value ? setReadAttempt(attempt => attempt + 1) : void generate()}>{t(failed && !value ? "bknTrace.evidenceChain.current.retryRead" : value?.view ? "bknTrace.evidenceChain.current.refresh" : "bknTrace.evidenceChain.current.generate")}</Button>
    {busy && <Spin />}
    {failed && <Alert type="error" showIcon message={t(failed && !value ? "bknTrace.evidenceChain.current.readFailed" : "bknTrace.evidenceChain.current.failed")} />}
    {!busy && !failed && value?.status === "not_generated" && <p>{t("bknTrace.evidenceChain.current.empty")}</p>}
    {value?.generatedAt && <p>{t("bknTrace.evidenceChain.current.generatedAt", { time: formatDateTime(value.generatedAt) })}</p>}
    {value?.view && <EvidenceChainPanels key={`${interactionId}:${value.generatedAt ?? ""}:${panel ?? "evidence"}`} view={value.view} initialPanel={panel} panel={panel} onPanelChange={onPanelChange} />}
  </section>;
}
