/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useState } from "react";
import { Descriptions, Modal, Space, Typography } from "antd";
import { precisionPreservingValueText } from "@/framework/request/precision-safe-json";
import { AppButton } from "@/framework/ui/common/AppButton";
import { EvalPaginatedTable } from "./EvalPaginatedTable";
import { EvalResultValue } from "./EvalResultValue";
import type { EvalResourceQuerySummary } from "./m0-run.service";
import { useEvalTranslation } from "./useEvalTranslation";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function joinFieldsText(value: unknown) {
  return Object.entries(asRecord(value) ?? {})
    .map(
      ([key, entry]) =>
        `${key}=${typeof entry === "string" ? entry : precisionPreservingValueText(entry)}`,
    )
    .join(", ");
}

export function EvalRelationCheckResult({ summary }: { summary?: EvalResourceQuerySummary }) {
  const { t } = useEvalTranslation();
  const [declarationOpen, setDeclarationOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, unknown>>();
  const text = (key: string) => t(`knowledgeNetwork.eval.relationChecks.${key}`);
  const check = summary?.relation_check;
  if (!check) return null;
  const snapshot = check.declaration_snapshot;
  const selectedFinding = selected && check.findings?.includes(selected) ? selected : undefined;
  const unit =
    check.violation_unit === "record_properties"
      ? text("propertyViolationUnit")
      : check.violation_unit === "bridge_records"
        ? text("recordViolationUnit")
        : undefined;
  const propertyCheck = check.rule === "relation-property-values";
  const actualValue = (row: Record<string, unknown>) =>
    "value" in row ? row.value : (row.instance ?? row.record ?? row.actual_count ?? row);
  const rangeDescription = (property: unknown) => {
    const range = asRecord(asRecord(asRecord(property)?.constraints)?.range);
    return range
      ? t("knowledgeNetwork.eval.relationChecks.constraintRange", {
          min:
            range.min === undefined ? text("unbounded") : precisionPreservingValueText(range.min),
          max:
            range.max === undefined ? text("unbounded") : precisionPreservingValueText(range.max),
        })
      : undefined;
  };
  if (propertyCheck && !snapshot) {
    return (
      <Typography.Paragraph type="danger">{text("incompleteDeclaration")}</Typography.Paragraph>
    );
  }
  return (
    <section aria-label={text("results")} style={{ minWidth: 0 }}>
      <Space wrap align="baseline">
        <Typography.Title level={5}>{text("results")}</Typography.Title>
        {snapshot && (
          <AppButton size="small" type="link" onClick={() => setDeclarationOpen(true)}>
            {text("viewConstraint")}
          </AppButton>
        )}
      </Space>
      <Descriptions
        size="small"
        column={2}
        items={[
          {
            key: "direction",
            label: text("direction"),
            children: `${check.source_object_type || snapshot?.source_object_type_id || "—"} → ${check.target_object_type || snapshot?.target_object_type_id || "—"}`,
          },
          { key: "checked", label: text("checked"), children: check.checked },
          ...(check.violations === undefined
            ? []
            : [
                {
                  key: "violations",
                  label: text("violations"),
                  children: unit ? `${check.violations} ${unit}` : check.violations,
                },
              ]),
        ]}
      />
      {check.actual && (
        <Space direction="vertical" style={{ width: "100%" }}>
          <Typography.Text strong>{text("actual")}</Typography.Text>
          <EvalResultValue value={check.actual} label={text("actual")} />
        </Space>
      )}
      {check.findings_truncated && (
        <Typography.Paragraph type="secondary">
          {t("knowledgeNetwork.eval.relationChecks.findingsTruncated", {
            shown: check.findings?.length ?? 0,
            total: check.findings_total ?? check.violations,
          })}
        </Typography.Paragraph>
      )}
      {!!check.findings?.length && (
        <EvalPaginatedTable
          rowKey={(_, i) => String(i)}
          dataSource={check.findings}
          pagination={{ pageSize: 5 }}
          scroll={{ x: 920 }}
          columns={[
            {
              title: text("field"),
              dataIndex: "field",
              width: 150,
              ellipsis: true,
              render: (field: unknown) => (typeof field === "string" ? field : "—"),
            },
            {
              title: text("actual"),
              width: 250,
              render: (_, row) => (
                <EvalResultValue value={actualValue(row)} label={text("actual")} />
              ),
            },
            { title: text("reason"), dataIndex: "reason", width: 220 },
            {
              title: text("record"),
              width: 280,
              render: (_, row) => {
                const range = asRecord(
                  asRecord(asRecord(row.property_snapshot)?.constraints)?.range,
                );
                return (
                  <Space direction="vertical" size={0}>
                    {row.source_identity !== undefined && row.target_identity !== undefined && (
                      <Typography.Text>
                        {joinFieldsText(row.source_identity)} →{" "}
                        {joinFieldsText(row.target_identity)}
                      </Typography.Text>
                    )}
                    {range && (
                      <Typography.Text type="secondary">
                        {t("knowledgeNetwork.eval.relationChecks.constraintRange", {
                          min:
                            range.min === undefined
                              ? text("unbounded")
                              : precisionPreservingValueText(range.min),
                          max:
                            range.max === undefined
                              ? text("unbounded")
                              : precisionPreservingValueText(range.max),
                        })}
                      </Typography.Text>
                    )}
                    <AppButton size="small" type="link" onClick={() => setSelected(row)}>
                      {text("viewRecord")}
                    </AppButton>
                  </Space>
                );
              },
            },
          ]}
        />
      )}
      <Typography.Paragraph type="secondary">
        {check.boundary || text("boundary")}
      </Typography.Paragraph>
      <Modal
        open={declarationOpen && Boolean(snapshot)}
        title={text("executedDeclaration")}
        footer={null}
        width={800}
        onCancel={() => setDeclarationOpen(false)}
      >
        {snapshot && (
          <Space direction="vertical" style={{ width: "100%" }}>
            <Descriptions
              size="small"
              column={1}
              items={[
                {
                  key: "digest",
                  label: text("declarationDigest"),
                  children: <Typography.Text code>{snapshot.sha256}</Typography.Text>,
                },
              ]}
            />
            <Descriptions
              size="small"
              column={1}
              items={snapshot.properties.map((property, index) => ({
                key: String(index),
                label: typeof property.name === "string" ? property.name : text("field"),
                children: (
                  <Space wrap>
                    <Typography.Text>
                      {typeof property.type === "string" ? property.type : ""}
                    </Typography.Text>
                    {property.required === true && (
                      <Typography.Text>{text("requiredProperty")}</Typography.Text>
                    )}
                    <Typography.Text>{rangeDescription(property)}</Typography.Text>
                  </Space>
                ),
              }))}
            />
            <EvalResultValue value={snapshot.properties} label={text("constraint")} />
            {snapshot.value_types && (
              <EvalResultValue value={snapshot.value_types} label={text("executedDeclaration")} />
            )}
          </Space>
        )}
      </Modal>
      <Modal
        open={Boolean(selectedFinding)}
        title={text("dataSnapshot")}
        footer={null}
        width={900}
        styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
        onCancel={() => setSelected(undefined)}
      >
        {selectedFinding && (
          <Space direction="vertical" style={{ width: "100%" }}>
            <Descriptions
              size="small"
              column={1}
              items={[
                ...(selectedFinding.source_identity !== undefined
                  ? [
                      {
                        key: "sourceJoin",
                        label: text("sourceIdentity"),
                        children: joinFieldsText(selectedFinding.source_identity),
                      },
                    ]
                  : []),
                ...(selectedFinding.target_identity !== undefined
                  ? [
                      {
                        key: "targetJoin",
                        label: text("targetIdentity"),
                        children: joinFieldsText(selectedFinding.target_identity),
                      },
                    ]
                  : []),
                ...("value" in selectedFinding
                  ? [
                      {
                        key: "actualValue",
                        label: text("actual"),
                        children: precisionPreservingValueText(selectedFinding.value),
                      },
                    ]
                  : []),
                ...(rangeDescription(selectedFinding.property_snapshot)
                  ? [
                      {
                        key: "requiredRange",
                        label: text("constraint"),
                        children: rangeDescription(selectedFinding.property_snapshot),
                      },
                    ]
                  : []),
                ...(typeof selectedFinding.record_index === "number"
                  ? [
                      {
                        key: "index",
                        label: text("recordIndex"),
                        children: selectedFinding.record_index + 1,
                      },
                    ]
                  : []),
                ...(typeof selectedFinding.bridge_resource_id === "string"
                  ? [
                      {
                        key: "bridge",
                        label: text("bridgeResource"),
                        children: selectedFinding.bridge_resource_id,
                      },
                    ]
                  : []),
                {
                  key: "field",
                  label: text("field"),
                  children: typeof selectedFinding.field === "string" ? selectedFinding.field : "—",
                },
                {
                  key: "reason",
                  label: text("reason"),
                  children:
                    typeof selectedFinding.reason === "string" ? selectedFinding.reason : "—",
                },
              ]}
            />
            {selectedFinding.record !== undefined ? (
              <EvalResultValue value={selectedFinding.record} label={text("record")} />
            ) : (
              <Typography.Paragraph type="secondary">
                {text("recordUnavailable")}
              </Typography.Paragraph>
            )}
            {selectedFinding.property_snapshot !== undefined ? (
              <>
                <Typography.Text>
                  {rangeDescription(selectedFinding.property_snapshot)}
                </Typography.Text>
                <EvalResultValue
                  value={selectedFinding.property_snapshot}
                  label={text("constraint")}
                />
                {typeof selectedFinding.constraint_sha256 === "string" && (
                  <Descriptions
                    size="small"
                    column={1}
                    items={[
                      {
                        key: "constraintDigest",
                        label: text("declarationDigest"),
                        children: (
                          <Typography.Text code>
                            {selectedFinding.constraint_sha256}
                          </Typography.Text>
                        ),
                      },
                    ]}
                  />
                )}
              </>
            ) : (
              propertyCheck && (
                <Typography.Paragraph type="secondary">
                  {text("incompleteDeclaration")}
                </Typography.Paragraph>
              )
            )}
          </Space>
        )}
      </Modal>
    </section>
  );
}
