/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Tag } from "antd";
import { useTranslation } from "react-i18next";

import type {
  CapabilityInputSemantic,
  CapabilityManifest,
  CapabilityOutputSemantic,
} from "@/modules/execution-factory/types/capability-manifest";
import { getCapabilityReadiness } from "@/modules/execution-factory/utils/capability-manifest";

import styles from "./HttpCapabilityContractPanel.module.css";

type HttpCapabilityContractPanelProps = {
  manifest: CapabilityManifest;
};

function formatValue(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "-";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function formatExamples(examples?: unknown[]) {
  if (!examples?.length) {
    return "-";
  }

  return examples.slice(0, 2).map(formatValue).join(", ");
}

function missingLabel(item: string) {
  return `Missing: ${item}`;
}

function InputSemanticsTable({ items }: { items: CapabilityInputSemantic[] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Location</th>
            <th>Type</th>
            <th>Required</th>
            <th>Business meaning</th>
            <th>Example</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={`${item.location ?? "argument"}:${item.name}`}>
              <td>{item.name}</td>
              <td>{item.location ?? "argument"}</td>
              <td>{item.dataType ?? "-"}</td>
              <td>{item.required ? "Yes" : "No"}</td>
              <td>{item.businessMeaning ?? "-"}</td>
              <td>{formatExamples(item.examples)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OutputSemanticsTable({ items }: { items: CapabilityOutputSemantic[] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Path</th>
            <th>Type</th>
            <th>Business meaning</th>
            <th>Example</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={`${item.path ?? item.name}:${item.dataType ?? ""}`}>
              <td>{item.name}</td>
              <td>{item.path ?? "-"}</td>
              <td>{item.dataType ?? "-"}</td>
              <td>{item.businessMeaning ?? "-"}</td>
              <td>{formatExamples(item.examples)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HttpCapabilityContractPanel({ manifest }: HttpCapabilityContractPanelProps) {
  const { t } = useTranslation();
  const readiness = getCapabilityReadiness(manifest);
  const inputs = manifest.inputSemantics ?? [];
  const outputs = manifest.outputSemantics ?? [];
  const sideEffects = manifest.sideEffects ?? "unknown";
  const riskLevel = manifest.riskLevel ?? "medium";
  const dataSensitivity = manifest.dataSensitivity ?? "normal";
  const agentVisibility = manifest.agentVisibility ?? "hidden";
  const invokePolicy = manifest.agentInvokePolicy ?? "manual_only";

  return (
    <section className={styles.panel} data-testid="http-capability-contract-panel">
      <div className={styles.grid}>
        <div className={styles.panel}>
          <section className={styles.section}>
            <div className={styles.sectionTitle}>
              <h3>
                {t("executionFactory.httpContract.intentTitle", {
                  defaultValue: "Business intent",
                })}
              </h3>
            </div>
            <p className={styles.intent}>
              {manifest.intent ||
                manifest.description ||
                t("executionFactory.httpContract.emptyIntent", {
                  defaultValue: "Describe when people or agents should use this capability.",
                })}
            </p>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionTitle}>
              <h3>
                {t("executionFactory.httpContract.inputTitle", {
                  defaultValue: "Input semantics",
                })}
              </h3>
              <Tag>{inputs.length}</Tag>
            </div>
            {inputs.length > 0 ? (
              <InputSemanticsTable items={inputs} />
            ) : (
              <p className={styles.muted}>
                {t("executionFactory.httpContract.emptyInputs", {
                  defaultValue: "No input parameters were detected.",
                })}
              </p>
            )}
          </section>

          <section className={styles.section}>
            <div className={styles.sectionTitle}>
              <h3>
                {t("executionFactory.httpContract.outputTitle", {
                  defaultValue: "Output semantics",
                })}
              </h3>
              <Tag>{outputs.length}</Tag>
            </div>
            {outputs.length > 0 ? (
              <OutputSemanticsTable items={outputs} />
            ) : (
              <p className={styles.muted}>
                {t("executionFactory.httpContract.emptyOutputs", {
                  defaultValue: "No response fields were detected.",
                })}
              </p>
            )}
          </section>
        </div>

        <aside className={styles.readiness}>
          <div className={styles.score}>
            <span className={styles.scoreValue}>{readiness.score}%</span>
            <span className={styles.muted}>
              {t("executionFactory.httpContract.agentReady", {
                defaultValue: "Agent Ready",
              })}
            </span>
          </div>
          <div className={styles.bar}>
            <div className={styles.barFill} style={{ width: `${readiness.score}%` }} />
          </div>

          <div className={styles.policyGrid}>
            <Tag>{`Side effect: ${sideEffects}`}</Tag>
            <Tag>{`Risk: ${riskLevel}`}</Tag>
            <Tag>{`Data sensitivity: ${dataSensitivity}`}</Tag>
            <Tag>{`Agent: ${agentVisibility}`}</Tag>
            <Tag>{`Invoke: ${invokePolicy}`}</Tag>
            <Tag>{`Verification: ${manifest.testStatus ?? "untested"}`}</Tag>
          </div>

          {readiness.missing.length > 0 ? (
            <>
              <div className={styles.sectionTitle} style={{ marginTop: 16 }}>
                <h3>
                  {t("executionFactory.httpContract.missingTitle", {
                    defaultValue: "Missing items",
                  })}
                </h3>
              </div>
              <div className={styles.tags}>
                {readiness.missing.map((item) => (
                  <Tag key={item}>{missingLabel(item)}</Tag>
                ))}
              </div>
            </>
          ) : (
            <p className={styles.muted}>
              {t("executionFactory.httpContract.ready", {
                defaultValue: "This capability has enough semantics for Agent review.",
              })}
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}
