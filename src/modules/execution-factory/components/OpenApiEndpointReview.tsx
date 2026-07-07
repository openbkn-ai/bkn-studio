/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { extractOpenApiOperationsIo } from "@/modules/execution-factory/utils/openapi-operation-io";

import styles from "./OpenApiEndpointReview.module.css";

type OpenApiEndpointReviewProps = {
  limit?: number;
  openapiSpec?: string;
};

type EndpointRisk = "low" | "medium" | "high";

function inferEndpointRisk(method: string, path: string, summary?: string): EndpointRisk {
  const upperMethod = method.toUpperCase();
  const text = `${path} ${summary ?? ""}`.toLowerCase();

  if (upperMethod === "DELETE" || /delete|remove|cancel|approve|pay|submit/.test(text)) {
    return "high";
  }

  if (["POST", "PUT", "PATCH"].includes(upperMethod)) {
    return "medium";
  }

  return "low";
}

function riskClassName(risk: EndpointRisk) {
  if (risk === "high") {
    return `${styles.risk} ${styles.riskHigh}`;
  }

  if (risk === "medium") {
    return `${styles.risk} ${styles.riskMedium}`;
  }

  return `${styles.risk} ${styles.riskLow}`;
}

export function OpenApiEndpointReview({
  limit = 12,
  openapiSpec,
}: OpenApiEndpointReviewProps) {
  const { t } = useTranslation();
  const operations = useMemo(() => extractOpenApiOperationsIo(openapiSpec), [openapiSpec]);
  const visibleOperations = operations.slice(0, limit);

  if (visibleOperations.length === 0) {
    return null;
  }

  return (
    <section className={styles.root} data-testid="openapi-endpoint-review">
      <div className={styles.header}>
        <span className={styles.title}>
          {t("executionFactory.openapiEndpointReviewTitle", {
            defaultValue: "Endpoint review",
          })}
        </span>
        <span className={styles.count}>
          {t("executionFactory.openapiEndpointReviewCount", {
            count: operations.length,
            defaultValue: `${operations.length} endpoints detected`,
          })}
        </span>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>
              {t("executionFactory.openapiEndpointReviewMethod", {
                defaultValue: "Method",
              })}
            </th>
            <th>
              {t("executionFactory.openapiEndpointReviewPath", {
                defaultValue: "Path",
              })}
            </th>
            <th>
              {t("executionFactory.openapiEndpointReviewSummary", {
                defaultValue: "Summary",
              })}
            </th>
            <th>
              {t("executionFactory.openapiEndpointReviewRisk", {
                defaultValue: "Risk",
              })}
            </th>
            <th>
              {t("executionFactory.openapiEndpointReviewIo", {
                defaultValue: "IO",
              })}
            </th>
          </tr>
        </thead>
        <tbody>
          {visibleOperations.map((operation) => {
            const risk = inferEndpointRisk(
              operation.method,
              operation.path,
              operation.summary,
            );
            const inputCount = operation.io.parameters.length;
            const responseCount = Object.keys(operation.io.responses ?? {}).length;

            return (
              <tr key={`${operation.method}:${operation.path}`}>
                <td>
                  <span className={styles.method}>{operation.method}</span>
                </td>
                <td>
                  <code className={styles.path}>{operation.path}</code>
                </td>
                <td className={styles.summary}>{operation.summary ?? "-"}</td>
                <td>
                  <span className={riskClassName(risk)}>{risk}</span>
                </td>
                <td className={styles.io}>
                  {inputCount} input · {responseCount} response
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
