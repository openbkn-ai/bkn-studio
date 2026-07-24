/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Empty, Table, Tabs, Tag } from "antd";
import { useTranslation } from "react-i18next";

import type { FunctionInputPayload } from "@/modules/execution-factory/types/function-input";
import type {
  ToolIoParameter,
  ToolIoSpec,
  ToolRunLogEntry,
} from "@/modules/execution-factory/types/tool";
import { formatExecutionUnitTime } from "@/modules/execution-factory/utils/format-timestamp";
import { resolveIoPreviewValue } from "@/modules/execution-factory/utils/generate-sample-json";

import { JsonCodeBlock } from "./JsonCodeBlock";
import styles from "./ToolIoPanel.module.css";

type ToolIoPanelProps = {
  functionInput?: FunctionInputPayload;
  ioSpec?: ToolIoSpec;
  runLogs?: ToolRunLogEntry[];
};

function ParameterTable({
  emptyText,
  parameters,
  showLocation,
}: {
  emptyText: string;
  parameters: ToolIoParameter[];
  showLocation?: boolean;
}) {
  const { t } = useTranslation();

  if (parameters.length === 0) {
    return <p className={styles.emptyHint}>{emptyText}</p>;
  }

  return (
    <Table
      columns={[
        { dataIndex: "name", key: "name", title: t("executionFactory.parameterName") },
        ...(showLocation
          ? [
              {
                dataIndex: "in",
                key: "in",
                title: t("executionFactory.globalParameterIn"),
              },
            ]
          : []),
        { dataIndex: "type", key: "type", title: t("executionFactory.parameterType") },
        {
          dataIndex: "required",
          key: "required",
          render: (value?: boolean) => (value ? "✓" : "-"),
          title: t("executionFactory.globalParameterRequired"),
        },
        {
          dataIndex: "description",
          key: "description",
          title: t("executionFactory.parameterDescription"),
        },
      ]}
      dataSource={parameters.map((item, index) => ({
        ...item,
        key: `${item.in ?? "param"}-${item.name}-${index}`,
      }))}
      pagination={false}
      size="small"
    />
  );
}

export function ToolIoPanel({ functionInput, ioSpec, runLogs = [] }: ToolIoPanelProps) {
  const { t } = useTranslation();

  const functionParameters = [
    ...(functionInput?.inputs ?? []).map((item) => ({
      direction: "input",
      ...item,
    })),
    ...(functionInput?.outputs ?? []).map((item) => ({
      direction: "output",
      ...item,
    })),
  ];

  const headerParameters = (ioSpec?.parameters ?? []).filter(
    (parameter) => parameter.in === "header",
  );
  const requestParameters = (ioSpec?.parameters ?? []).filter(
    (parameter) => parameter.in !== "header",
  );

  const hasOpenApiIo =
    Boolean(ioSpec?.parameters.length) ||
    Boolean(ioSpec?.requestBodyDescription) ||
    Boolean(ioSpec?.requestBodyExample) ||
    Boolean(ioSpec?.requestBodySchema) ||
    Boolean(Object.keys(ioSpec?.responses ?? {}).length);

  const hasFunctionIo = functionParameters.length > 0;

  if (!hasOpenApiIo && !hasFunctionIo && runLogs.length === 0) {
    return (
      <div className={styles.panel}>
        <Empty description={t("executionFactory.ioPanelEmpty")}>
          <p className={styles.emptyHint}>{t("executionFactory.ioPanelEmptyHint")}</p>
        </Empty>
      </div>
    );
  }

  const responseTabs = Object.entries(ioSpec?.responses ?? {}).map(([statusCode, response]) => ({
    key: statusCode,
    label: statusCode,
    children: (
      <div>
        <p className={styles.emptyHint}>{response.description ?? "-"}</p>
        <JsonCodeBlock value={resolveIoPreviewValue(response.example, response.schema)} />
      </div>
    ),
  }));

  return (
    <div className={styles.panel}>
      {hasOpenApiIo ? (
        <>
          <section>
            <h4 className={styles.sectionTitle}>{t("executionFactory.ioParameters")}</h4>
            <ParameterTable
              emptyText={t("executionFactory.noParameters")}
              parameters={requestParameters}
              showLocation
            />
          </section>
          {headerParameters.length > 0 ? (
            <section>
              <h4 className={styles.sectionTitle}>{t("executionFactory.ioHeaders")}</h4>
              <ParameterTable
                emptyText={t("executionFactory.noParameters")}
                parameters={headerParameters}
              />
            </section>
          ) : null}
          <section>
            <h4 className={styles.sectionTitle}>{t("executionFactory.ioRequestBody")}</h4>
            {ioSpec?.requestBodyDescription ? (
              <p className={styles.emptyHint}>{ioSpec.requestBodyDescription}</p>
            ) : null}
            <JsonCodeBlock
              value={resolveIoPreviewValue(
                ioSpec?.requestBodyExample,
                ioSpec?.requestBodySchema,
              )}
            />
          </section>
          {responseTabs.length ? (
            <section>
              <h4 className={styles.sectionTitle}>{t("executionFactory.ioResponses")}</h4>
              <Tabs items={responseTabs} size="small" />
            </section>
          ) : null}
        </>
      ) : null}

      {hasFunctionIo ? (
        <section>
          <h4 className={styles.sectionTitle}>{t("executionFactory.functionIoTitle")}</h4>
          <Table
            columns={[
              {
                dataIndex: "direction",
                key: "direction",
                render: (value: string) => (
                  <Tag color={value === "input" ? "blue" : "green"}>
                    {value === "input"
                      ? t("executionFactory.functionInputs")
                      : t("executionFactory.functionOutputs")}
                  </Tag>
                ),
                title: t("executionFactory.ioDirection"),
              },
              { dataIndex: "name", key: "name", title: t("executionFactory.parameterName") },
              { dataIndex: "type", key: "type", title: t("executionFactory.parameterType") },
              {
                dataIndex: "description",
                key: "description",
                title: t("executionFactory.parameterDescription"),
              },
            ]}
            dataSource={functionParameters.map((item, index) => ({
              ...item,
              key: `${item.direction}-${item.name ?? index}`,
            }))}
            pagination={false}
            size="small"
          />
        </section>
      ) : null}

      {runLogs.length ? (
        <section>
          <h4 className={styles.sectionTitle}>{t("executionFactory.runLogSessionTitle")}</h4>
          <div className={styles.logList}>
            {runLogs.map((entry) => (
              <div className={styles.logItem} key={entry.id}>
                <div className={styles.logMeta}>
                  {formatExecutionUnitTime(entry.timestamp)} ·{" "}
                  {entry.statusCode ?? "-"} · {entry.durationMs ?? "-"}ms
                  {entry.error ? ` · ${entry.error}` : ""}
                </div>
                <JsonCodeBlock value={entry.body} />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
