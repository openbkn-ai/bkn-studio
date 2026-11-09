/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { resultUiText } from "./result-ui-text";

import { Button, Select, Spin, Typography } from "antd";
import { KnowledgeResourceIcon } from "@/modules/knowledge-network/components/shared/KnowledgeResourceIcon";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import type { EvalCaseResourceSummaryPage } from "./m0-run.service";
import { useEvalTranslation } from "./useEvalTranslation";
import styles from "./EvalWorkspaceScene.module.css";

export type EvalCaseResourceType =
  | "all"
  | "objectType"
  | "relationType"
  | "action"
  | "metric"
  | "function"
  | "api"
  | "mcp"
  | "skill"
  | "scenario";
export type EvalCaseResourceFilter = { type: EvalCaseResourceType; name: string };
type Props = {
  filter: EvalCaseResourceFilter;
  summary: EvalCaseResourceSummaryPage | null;
  loading: boolean;
  error: boolean;
  page: number;
  pageSize?: number;
  onChange: (filter: EvalCaseResourceFilter) => void;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  className?: string;
  countHelp?: string;
};

/** Shared resource navigation for the Case library and test-set member picker. */
export function EvalCaseResourceSidebar({
  filter,
  summary,
  loading,
  error,
  page,
  pageSize = 10,
  onChange,
  onPageChange,
  onRetry,
  className,
  countHelp,
}: Props) {
  const { t } = useEvalTranslation();
  const options: { value: EvalCaseResourceType; label: string }[] = [
    { value: "all", label: resultUiText("allTypes") },
    { value: "objectType", label: resultUiText("objectType") },
    { value: "relationType", label: resultUiText("relationType") },
    { value: "action", label: resultUiText("action") },
    { value: "function", label: resultUiText("function") },
    { value: "metric", label: resultUiText("metric") },
    { value: "api", label: "API" },
    { value: "mcp", label: "MCP" },
    { value: "skill", label: "SKILLS" },
    { value: "scenario", label: resultUiText("scenario") },
  ];
  const kindLabel = (kind: string) =>
    options.find((o) => o.value === kind)?.label ??
    t("knowledgeNetwork.eval.ruleApplication.resource");
  return (
    <nav
      className={`${styles.caseResources} ${className ?? ""}`}
      aria-label={resultUiText("resourceList")}
    >
      <div className={styles.caseResourcePicker}>
        <label className={styles.runFilterField}>
          <span>{t("knowledgeNetwork.eval.filterUi.type")}</span>
          <Select<EvalCaseResourceType>
            aria-label={resultUiText("locateType")}
            value={filter.type}
            options={options}
            onChange={(type) => onChange({ type, name: "" })}
          />
        </label>
      </div>
      <div className={styles.caseResourceItems}>
        <button
          type="button"
          aria-label={resultUiText("allResources")}
          className={
            !filter.name && filter.type !== "scenario" ? styles.caseResourceActive : undefined
          }
          onClick={() => onChange({ ...filter, name: "" })}
        >
          <span className={styles.caseResourceLabel}>
            <span className={styles.caseResourceIcons} aria-hidden="true">
              <KnowledgeResourceIcon kind="all" />
            </span>
            <span className={styles.caseResourceName}>{resultUiText("allResources")}</span>
          </span>
          <small title={t("knowledgeNetwork.eval.caseResources.totalCases")}>
            {!error && summary ? summary.case_total : "—"}
          </small>
        </button>
        {loading ? (
          <Spin size="small" aria-label={t("knowledgeNetwork.eval.caseResources.loading")} />
        ) : error ? (
          <div role="alert">
            <Typography.Text type="secondary">
              {t("knowledgeNetwork.eval.caseResources.failed")}
            </Typography.Text>
            <Button type="link" onClick={onRetry}>
              {t("knowledgeNetwork.eval.suiteCaseUi.retry")}
            </Button>
          </div>
        ) : summary?.entries.length === 0 ? (
          <Typography.Text type="secondary">
            {t("knowledgeNetwork.eval.caseResources.empty")}
          </Typography.Text>
        ) : (
          summary?.entries.map(({ name, kinds, case_count: count }) => (
            <button
              key={name}
              type="button"
              title={name}
              aria-description={kinds.map(kindLabel).join("、")}
              className={
                filter.name === name ||
                (kinds.length === 1 &&
                  kinds[0] === "scenario" &&
                  filter.type === "scenario" &&
                  !filter.name)
                  ? styles.caseResourceActive
                  : undefined
              }
              onClick={() =>
                onChange(
                  kinds.length === 1 && kinds[0] === "scenario"
                    ? { type: "scenario", name: "" }
                    : { ...filter, name },
                )
              }
            >
              <span className={styles.caseResourceLabel}>
                <span
                  className={styles.caseResourceIcons}
                  aria-hidden="true"
                  title={kinds.map(kindLabel).join("、")}
                >
                  {kinds.map((kind) => (
                    <KnowledgeResourceIcon key={kind} kind={kind} />
                  ))}
                </span>
                <span className={styles.caseResourceName}>{name}</span>
              </span>
              <small title={countHelp ?? t("knowledgeNetwork.eval.caseResources.count")}>
                {count}
              </small>
            </button>
          ))
        )}
      </div>
      <div className={styles.caseResourcePagination}>
        {(summary?.total ?? 0) > pageSize && (
          <TablePaginationBar
            aria-label={resultUiText("resourcePagination")}
            current={page}
            pageSize={pageSize}
            total={summary?.total ?? 0}
            simple={{ readOnly: true }}
            showSizeChanger={false}
            onChange={(nextPage) => onPageChange(nextPage)}
          />
        )}
      </div>
    </nav>
  );
}
