/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Space, Table, Tag, Typography } from "antd";
import { useEvalTranslation } from "./useEvalTranslation";
import { evalScalarText } from "./eval-scalar-text";

type Finding = {
  assertion: string;
  effect: string;
  message: string;
  resources?: { id: string; name?: string; kind: string; path: string }[];
};
export function EvalDeclarationCheckResult({ value }: { value?: Record<string, unknown> }) {
  const { t } = useEvalTranslation();
  const text = (key: string) => t(`knowledgeNetwork.eval.declaration.${key}`);
  if (
    !value ||
    !Array.isArray(value.findings) ||
    typeof value.checked !== "number" ||
    typeof value.violations !== "number"
  )
    return null;
  const findings = value.findings as Finding[];
  return (
    <section aria-label={text("findings")}>
      <Space wrap style={{ marginBottom: 12 }}>
        <Typography.Text>
          {text("checked")}：{value.checked}
        </Typography.Text>
        <Typography.Text>
          {text("violations")}：{value.violations}
        </Typography.Text>
        {typeof value.candidates === "number" && (
          <Typography.Text>
            {text("candidates")}：{evalScalarText(value.candidates)}
          </Typography.Text>
        )}
        {typeof value.unknown === "number" && (
          <Typography.Text>
            {text("unknown")}：{evalScalarText(value.unknown)}
          </Typography.Text>
        )}
      </Space>
      {!!findings.length && (
        <Table
          size="small"
          rowKey={(_, i) => String(i)}
          dataSource={findings}
          pagination={findings.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
          columns={[
            {
              title: text("findingType"),
              dataIndex: "effect",
              width: 120,
              render: (effect: string) => (
                <Tag
                  color={
                    effect === "violation"
                      ? "error"
                      : effect === "candidate"
                        ? "warning"
                        : "default"
                  }
                >
                  {text(effect)}
                </Tag>
              ),
            },
            { title: text("findingMessage"), dataIndex: "message" },
            {
              title: text("findingResources"),
              dataIndex: "resources",
              render: (refs: Finding["resources"]) =>
                refs?.map((ref) => `${ref.name || ref.id} · ${ref.path}`).join("；") || "—",
            },
          ]}
        />
      )}
    </section>
  );
}
