/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { resultUiText } from "./result-ui-text";

import { evalReferenceLabel } from "./eval-readable-references";
import { Alert, Button, Collapse, Descriptions, Drawer, Space, Spin } from "antd";
import axios from "axios";
import { useEffect, useState } from "react";

import {
  getEvalCaseDefinition,
  getEvalSuiteCaseDetail,
  type EvalCaseSummary,
  type EvalCaseTarget,
  type EvalSuiteCaseDetail,
} from "./m0-run.service";
import { useEvalTranslation } from "./useEvalTranslation";
import styles from "./EvalWorkspaceScene.module.css";
import { EvalPaginatedTable as Table } from "./EvalPaginatedTable";
import {
  checkScopeLabel,
  criterionLabel,
  criterionStandard,
  definitionText,
  definitionValue,
  ruleLabel,
} from "./eval-definition-view";
import { caseExecutionSetupLabel } from "./eval-case-execution";

type Props = {
  networkId: string;
  suiteId?: string;
  suiteVersion?: number;
  caseId?: string;
  summary?: EvalCaseSummary;
  onClose: () => void;
  embedded?: boolean;
};

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const textValue = (value: unknown) => (typeof value === "string" ? value : "");
const json = (value: unknown) => (
  <pre style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
    {JSON.stringify(value, null, 2)}
  </pre>
);

export function EvalSuiteCaseDetailDrawer({
  networkId,
  suiteId,
  suiteVersion,
  caseId,
  summary,
  onClose,
  embedded = false,
}: Props) {
  const { t } = useEvalTranslation();
  const [detail, setDetail] = useState<EvalSuiteCaseDetail>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<"unavailable" | "forbidden" | "failed">();
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setDetail(undefined);
    setError(undefined);
    if (!caseId) return;
    let active = true;
    setLoading(true);
    const request =
      suiteId && suiteVersion
        ? getEvalSuiteCaseDetail(networkId, suiteId, suiteVersion, caseId)
        : getEvalCaseDefinition(networkId, caseId);
    void request
      .then((value) => {
        if (active) setDetail(value);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        const status = axios.isAxiosError(cause) ? cause.response?.status : undefined;
        setError(status === 404 ? "unavailable" : status === 403 ? "forbidden" : "failed");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [networkId, suiteId, suiteVersion, caseId, retry]);

  const label = (key: string) => t(`knowledgeNetwork.eval.suiteCaseUi.${key}`);
  const definition = detail?.definition;
  const input = definition?.input_spec ?? {};
  const execution = definition?.execution_spec ?? {};
  const scope = object(input.check_scope);
  const relatedTargets: unknown[] = Array.isArray(execution.related_targets)
    ? execution.related_targets
    : [];
  const targets = [execution.target, ...relatedTargets]
    .map((value) => object(value) as EvalCaseTarget)
    .filter((target) => target.name || target.resource_id);
  const scenario = execution.target_kind === "business_scenario";
  const renderTargets = () =>
    targets.map((target) => {
      const aliases: Record<string, string> = {
        object_type: "objectType",
        relation_type: "relationType",
        object_metric: "metric",
        action_type: "action",
      };
      const kind = target.capability_type
        ? (aliases[target.capability_type] ?? target.capability_type)
        : "";
      const name = [
        target.name || evalReferenceLabel("unnamedResource"),
        kind ? t(`knowledgeNetwork.eval.templateUi.kinds.${kind}`, { defaultValue: kind }) : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return (
        <div key={`${target.capability_type}:${target.resource_id}:${target.name}`}>{name}</div>
      );
    });

  const content = (
    <>
      {loading ? (
        <div style={{ padding: 32, textAlign: "center" }}>
          <Spin aria-label={label("loading")} />
        </div>
      ) : error ? (
        <Alert
          type="error"
          showIcon
          message={label(error)}
          action={<Button onClick={() => setRetry((value) => value + 1)}>{label("retry")}</Button>}
        />
      ) : detail && definition ? (
        <Space direction="vertical" size={20} style={{ width: "100%" }}>
          {suiteId && <Alert type="info" showIcon message={definitionText("currentCase")} />}
          {detail.archived && <Alert type="warning" showIcon message={label("archived")} />}
          <Descriptions className={styles.detailDescriptions} bordered size="small" column={1}>
            <Descriptions.Item label={label("name")}>{definition.title}</Descriptions.Item>
            <Descriptions.Item label={definitionText("creation")}>
              {definitionText(
                ["manual", "template", "imported_sample"].includes(String(detail.source.type))
                  ? String(detail.source.type)
                  : "unknownSource",
              )}
            </Descriptions.Item>
            <Descriptions.Item label={definitionText("caseType")}>
              {definitionText(
                ["functional", "scenario", "security"].includes(
                  String(definition.diagnostic_spec?.case_type),
                )
                  ? String(definition.diagnostic_spec.case_type)
                  : scenario
                    ? "scenario"
                    : "functional",
              )}
            </Descriptions.Item>
            {summary && (
              <Descriptions.Item label={definitionText("status")}>
                {t(`knowledgeNetwork.eval.terms.${summary.enabled ? "enabled" : "inactive"}`)}
              </Descriptions.Item>
            )}
            {summary && (
              <Descriptions.Item label={definitionText("readiness")}>
                {caseExecutionSetupLabel(summary)}
              </Descriptions.Item>
            )}
            <Descriptions.Item label={label("target")}>
              {scenario ? label("scenario") : targets.length ? renderTargets() : "—"}
            </Descriptions.Item>
            {scenario && targets.length > 0 && (
              <Descriptions.Item label={label("dependencies")}>{renderTargets()}</Descriptions.Item>
            )}
            <Descriptions.Item label={label("rule")}>{ruleLabel(detail)}</Descriptions.Item>
            <Descriptions.Item label={label("question")}>
              <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {textValue(input.question) || "—"}
              </span>
            </Descriptions.Item>
            {Object.keys(object(input.arguments)).length > 0 && (
              <Descriptions.Item label={label("arguments")}>
                {json(input.arguments)}
              </Descriptions.Item>
            )}
            {Boolean(scope.mode) && (
              <Descriptions.Item label={label("scope")}>{checkScopeLabel(scope)}</Descriptions.Item>
            )}
            <Descriptions.Item label={label("expected")}>
              {detail.gold_visible
                ? definition.expected_spec && "criteria" in definition.expected_spec
                  ? definitionText("expectedInCriteria")
                  : definitionValue(definition.expected_spec?.answer ?? definition.expected_spec)
                : label("goldHidden")}
            </Descriptions.Item>
            <Descriptions.Item label={label("source")}>
              {t(`knowledgeNetwork.eval.suiteCaseUi.sources.${definition.expected_source?.kind}`, {
                defaultValue: "—",
              })}
            </Descriptions.Item>
            <Descriptions.Item label={label("evidence")}>
              <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {definition.expected_source?.evidence_refs?.join("\n") || "—"}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label={label("note")}>
              <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {textValue(definition.diagnostic_spec?.note) || "—"}
              </span>
            </Descriptions.Item>
          </Descriptions>
          <Table<Record<string, unknown>>
            size="small"
            rowKey={(row) => String(row.id)}
            pagination={false}
            dataSource={definition.assertions}
            columns={[
              {
                title: definitionText("resultField"),
                render: (_, row) =>
                  row.path === "$"
                    ? definitionText("wholeResult")
                    : typeof row.path === "string"
                      ? row.path
                      : "—",
              },
              { title: definitionText("predicate"), render: (_, row) => criterionLabel(row) },
              {
                title: definitionText("expected"),
                render: (_, row) => (
                  <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                    {criterionStandard(row, detail)}
                  </span>
                ),
              },
            ]}
          />
          <Collapse
            items={[
              {
                key: "assertions",
                label: definitionText("rawConfiguration"),
                children: json(definition.assertions),
              },
              {
                key: "configuration",
                label: label("configuration"),
                children: json({ input_spec: input, execution_spec: execution }),
              },
            ]}
          />
        </Space>
      ) : null}
    </>
  );

  if (embedded) return content;

  return (
    <Drawer
      title={suiteId ? label("title") : definition?.title || summary?.title || label("title")}
      open={Boolean(caseId)}
      width="min(760px, 94vw)"
      destroyOnHidden
      onClose={onClose}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button onClick={onClose}>{suiteId ? label("back") : resultUiText("close")}</Button>
        </div>
      }
    >
      {content}
    </Drawer>
  );
}
