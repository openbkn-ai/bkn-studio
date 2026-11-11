/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import i18n from "i18next";
import type { EvalRepairContext } from "./eval-repair.service";

export type EvalReadableReference = { id: string; label: string };
export const evalReferenceLabel = (key: string, values?: Record<string, unknown>) =>
  i18n.t(`knowledgeNetwork.eval.referencesUi.${key}`, {
    ...values,
    interpolation: { escapeValue: false },
  });

/** Replace only known identities in user-facing prose; never rewrite stored evidence or inputs. */
export function readableEvalText(
  text: string,
  references: readonly EvalReadableReference[],
): string {
  const labels = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const { id, label } of references) {
    if (!id || !label || id === label) continue;
    if (labels.has(id) && labels.get(id) !== label) ambiguous.add(id);
    else labels.set(id, label);
  }
  for (const id of ambiguous) labels.delete(id);
  if (!labels.size) return text;
  const identifiers = [...labels.keys()]
    .sort((a, b) => b.length - a.length)
    .map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const prefix =
    "(?:caseRunId|case_run_id|caseId|case_id|runId|run_id|resource_id|rule_id|用例执行\\s*ID|用例\\s*ID|运行\\s*ID|资源\\s*ID)(?:\\s*[:：=]\\s*|\\s+)";
  const pattern = new RegExp(`(?<![\\w/-])(${prefix})?(${identifiers})(?![\\w/-])`, "g");
  const replaceProse = (value: string) =>
    value.replace(pattern, (match, kind: string | undefined, id: string) =>
      // A plain identifier can also be a real field name. Rewrite it only when
      // explicitly identified as a technical reference, e.g. "resource_id=orders".
      !kind && /^[A-Za-z_][A-Za-z0-9_]*$/.test(id) ? match : labels.get(id)!,
    );
  // Copyable technical examples and actual JSON outputs must retain their identity.
  return text
    .split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/g)
    .map((part, index) => (index % 2 ? part : replaceProse(part)))
    .join("");
}

export function repairReadableReferences(
  context: EvalRepairContext,
  retestRunId?: string,
): EvalReadableReference[] {
  return [
    { id: context.target.id, label: context.target.name },
    ...context.failures.flatMap((entry) => [
      {
        id: entry.caseId,
        label: evalReferenceLabel("case", {
          name: entry.title || evalReferenceLabel("unnamedCase"),
        }),
      },
      {
        id: entry.caseRunId,
        label: evalReferenceLabel("caseExecution", {
          name: entry.title || evalReferenceLabel("unnamedCase"),
        }),
      },
      { id: entry.runId, label: evalReferenceLabel("failedRun") },
    ]),
    ...(retestRunId ? [{ id: retestRunId, label: evalReferenceLabel("retestRun") }] : []),
  ];
}
