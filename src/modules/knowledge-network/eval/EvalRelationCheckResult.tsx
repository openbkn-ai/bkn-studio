/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Descriptions, Space, Typography } from "antd";
import { EvalPaginatedTable } from "./EvalPaginatedTable";
import { EvalResultValue } from "./EvalResultValue";
import type { EvalResourceQuerySummary } from "./m0-run.service";
import { useEvalTranslation } from "./useEvalTranslation";

export function EvalRelationCheckResult({ summary }: { summary?: EvalResourceQuerySummary }) {
  const { t } = useEvalTranslation();
  const text = (key: string) => t(`knowledgeNetwork.eval.relationChecks.${key}`);
  const check = summary?.relation_check;
  if (!check) return null;
  return (
    <section aria-label={text("results")} style={{ minWidth: 0 }}>
      <Typography.Title level={5}>{text("results")}</Typography.Title>
      <Descriptions
        size="small"
        column={2}
        items={[
          {
            key: "direction",
            label: text("direction"),
            children: `${check.source_object_type} → ${check.target_object_type}`,
          },
          { key: "checked", label: text("checked"), children: check.checked },
          ...(check.violations === undefined
            ? []
            : [{ key: "violations", label: text("violations"), children: check.violations }]),
        ]}
      />
      {check.actual && (
        <Space direction="vertical" style={{ width: "100%" }}>
          <Typography.Text strong>{text("actual")}</Typography.Text>
          <EvalResultValue value={check.actual} label={text("actual")} />
        </Space>
      )}
      {!!check.findings?.length && (
        <EvalPaginatedTable
          rowKey={(_, i) => String(i)}
          dataSource={check.findings}
          pagination={{ pageSize: 5 }}
          scroll={{ x: 620 }}
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
                <EvalResultValue
                  value={row.instance ?? row.record ?? row.value ?? row.actual_count ?? row}
                  label={text("actual")}
                />
              ),
            },
            { title: text("reason"), dataIndex: "reason", width: 220 },
          ]}
        />
      )}
      <Typography.Paragraph type="secondary">
        {check.boundary || text("boundary")}
      </Typography.Paragraph>
    </section>
  );
}
