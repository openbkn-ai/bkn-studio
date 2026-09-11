/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import "@/app/locales/i18n";
import { EvidenceChainPanels } from "./EvidenceChainPanels";
import type { EvidenceChainView } from "./evidence-chain.types";

/** Local developer preview only. Files remain in this browser; no upload or service call. */
export function EvidenceChainPreview() {
  const { t } = useTranslation();
  const [view, setView] = useState<EvidenceChainView>();
  const [error, setError] = useState(false);
  return <main><p>{t("bknTrace.evidenceChain.preview")}</p><input aria-label={t("bknTrace.evidenceChain.chooseFile")} type="file" accept="application/json,.json" onChange={event => {
    const file = event.target.files?.[0];
    setView(undefined); setError(false);
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setError(true); return; }
    void file.text().then(text => {
      const input: unknown = JSON.parse(text);
      // The developer supplies the internal read-model, not arbitrary source Trace.
      if (!input || typeof input !== "object" || !("interactionId" in input) || typeof input.interactionId !== "string" || !("claims" in input) || !Array.isArray(input.claims) || !("execution" in input) || !("evidence" in input)) throw new Error("invalid read model");
      const candidate = input as EvidenceChainView;
      const optionalText = (value: unknown) => value === undefined || typeof value === "string";
      if (!optionalText(candidate.question) || !optionalText(candidate.answer) || !optionalText(candidate.revisionLabel) || typeof candidate.status !== "string" || (candidate.notices && (!Array.isArray(candidate.notices) || !candidate.notices.every(n => typeof n === "string")))) throw new Error("invalid text");
      for (const graph of [candidate.execution, candidate.evidence]) {
        if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges) || graph.nodes.length > 500 || graph.edges.length > 1000) throw new Error("invalid graph");
        for (const node of graph.nodes) if (!node || typeof node.id !== "string" || typeof node.label !== "string" || typeof node.kind !== "string" || !optionalText(node.value) || !optionalText(node.detail) || !optionalText(node.technical)) throw new Error("invalid node");
        for (const edge of graph.edges) if (!edge || ![edge.id, edge.source, edge.target, edge.label].every(v => typeof v === "string")) throw new Error("invalid edge");
      }
      for (const claim of candidate.claims) {
        if (!claim || typeof claim.id !== "string" || typeof claim.label !== "string" || typeof claim.status !== "string" || !optionalText(claim.value) || !optionalText(claim.detail) || !Array.isArray(claim.nodeIds) || !claim.nodeIds.every(id => typeof id === "string")) throw new Error("invalid claim");
      }
      setView(candidate);
    }).catch(() => setError(true));
  }} />{error && <p role="alert">{t("bknTrace.evidenceChain.invalidFile")}</p>}{view && <EvidenceChainPanels view={view} />}</main>;
}
