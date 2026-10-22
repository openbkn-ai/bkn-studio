/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Tag } from "antd";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { CypherPlan } from "@/modules/knowledge-network/cypher/cypher-plan";
import type { CypherSchemaNames } from "@/modules/knowledge-network/cypher/graph-values";

import styles from "./CypherQueryScene.module.css";

/** `object_type_id.property` with the object type's name in front, when the schema has it. */
function propertyLabel(ref: string, names: CypherSchemaNames): string {
  const dot = ref.indexOf(".");
  if (dot < 0) return names.objectTypes[ref] ?? ref;
  const typeId = ref.slice(0, dot);
  const name = names.objectTypes[typeId];
  return name && name !== typeId ? `${name}.${ref.slice(dot + 1)}` : ref;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.planRow}>
      <span className={styles.planLabel}>{label}</span>
      <div className={styles.planValue}>{children}</div>
    </div>
  );
}

/** What an explained query would do: the plan run_cypher returned in place of rows. */
export function CypherPlanView({ plan, names }: { plan: CypherPlan; names: CypherSchemaNames }) {
  const { t } = useTranslation();
  const p = (key: string, options?: Record<string, unknown>) =>
    t(`knowledgeNetwork.cypherQuery.plan.${key}`, options ?? {});
  const objectName = (id: string) => names.objectTypes[id] ?? id;
  // A warning the page knows by code reads in the reader's language; any other keeps the
  // backend's own words.
  const warningText = (warning: string, code?: string) => {
    // Without the object types to name, the backend's own words say more.
    if (!code || (code === "row_filtered" && !plan.row_filtered?.length)) return warning;
    return t(`knowledgeNetwork.cypherQuery.plan.warningCodes.${code}`, {
      defaultValue: warning,
      limit: plan.limit,
      types: (plan.row_filtered ?? []).map(objectName).join("、"),
    });
  };
  const shapeKey = `shapes.${plan.shape}`;
  const shape = t(`knowledgeNetwork.cypherQuery.plan.${shapeKey}`, { defaultValue: plan.shape });
  return (
    <div className={styles.planView} data-testid="cypher-plan">
      {plan.warnings && plan.warnings.length > 0 ? (
        <Alert
          description={
            <ul className={styles.planList}>
              {plan.warnings.map((warning, index) => (
                <li key={warning}>{warningText(warning, plan.warning_codes?.[index])}</li>
              ))}
            </ul>
          }
          message={p("warnings")}
          showIcon
          type="warning"
        />
      ) : (
        <Alert message={p("ok")} showIcon type="success" />
      )}
      <Row label={p("shape")}>
        <Tag>{shape}</Tag>
        {plan.graph ? <Tag color="blue">{p("graph")}</Tag> : null}
      </Row>
      <Row label={p("objects")}>
        {plan.objects.map((item) => (
          <Tag key={item.alias}>
            {item.alias}: {objectName(item.object_type_id)}
          </Tag>
        ))}
      </Row>
      {plan.relations && plan.relations.length > 0 ? (
        <Row label={p("relations")}>
          {plan.relations.map((item) => (
            <Tag key={`${item.source}-${item.relation_type_id}-${item.target}`}>
              {/* The source and target already follow the relation's own direction. */}
              {item.source} -[{names.relationTypes[item.relation_type_id] ?? item.relation_type_id}
              ]-
              {item.direction === "undirected" ? "" : ">"} {item.target}
            </Tag>
          ))}
        </Row>
      ) : null}
      {plan.conditions && plan.conditions.length > 0 ? (
        <Row label={p("conditions")}>
          <ul className={styles.planList}>
            {plan.conditions.map((item, index) => (
              <li key={index}>
                <code>{item.expression ?? item.operator}</code>
                {item.where ? <Tag className={styles.planWhere}>{item.where}</Tag> : null}
              </li>
            ))}
          </ul>
        </Row>
      ) : null}
      {plan.grouping && plan.grouping.length > 0 ? (
        <Row label={p("grouping")}>
          {plan.grouping.map((item) => (
            <Tag key={item}>{propertyLabel(item, names)}</Tag>
          ))}
        </Row>
      ) : null}
      <Row label={p("columns")}>
        {plan.columns.map((item) => (
          <Tag key={item.name}>
            {item.name} · {item.kind}
          </Tag>
        ))}
      </Row>
      {plan.ordering && plan.ordering.length > 0 ? (
        <Row label={p("ordering")}>
          {plan.ordering.map((item, index) => (
            <Tag key={index}>
              {item.column ?? propertyLabel(item.property ?? "", names)}{" "}
              {item.descending ? "DESC" : "ASC"}
            </Tag>
          ))}
        </Row>
      ) : null}
      <Row label={p("limit")}>
        {plan.limit_source === "explicit"
          ? p("limitExplicit", { limit: plan.limit })
          : p("limitDefault", { limit: plan.limit })}
      </Row>
      <Row label={p("reads")}>
        {plan.reads.map((item) => (
          <Tag key={item}>{propertyLabel(item, names)}</Tag>
        ))}
      </Row>
      {plan.row_filtered && plan.row_filtered.length > 0 ? (
        <Row label={p("rowFiltered")}>
          {plan.row_filtered.map((item) => (
            <Tag color="gold" key={item}>
              {objectName(item)}
            </Tag>
          ))}
        </Row>
      ) : null}
    </div>
  );
}
