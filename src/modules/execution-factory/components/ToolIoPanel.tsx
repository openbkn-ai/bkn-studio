import { Empty, Table, Tabs, Tag } from "antd";
import { useTranslation } from "react-i18next";

import type { FunctionInputPayload } from "@/modules/execution-factory/types/function-input";
import type { ToolIoSpec, ToolRunLogEntry } from "@/modules/execution-factory/types/tool";
import { formatExecutionUnitTime } from "@/modules/execution-factory/utils/format-timestamp";

import styles from "./ToolIoPanel.module.css";

type ToolIoPanelProps = {
  functionInput?: FunctionInputPayload;
  ioSpec?: ToolIoSpec;
  runLogs?: ToolRunLogEntry[];
};

function renderJson(value: unknown) {
  if (value === undefined || value === null) {
    return "-";
  }

  return JSON.stringify(value, null, 2);
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

  const hasOpenApiIo =
    Boolean(ioSpec?.parameters.length) ||
    Boolean(ioSpec?.requestBodyDescription) ||
    Boolean(ioSpec?.requestBodyExample) ||
    Boolean(Object.keys(ioSpec?.responses ?? {}).length);

  const hasFunctionIo = functionParameters.length > 0;

  if (!hasOpenApiIo && !hasFunctionIo && runLogs.length === 0) {
    return (
      <div className={styles.panel}>
        <Empty description={t("executionFactory.ioPanelEmpty")} />
      </div>
    );
  }

  const responseTabs = Object.entries(ioSpec?.responses ?? {}).map(([statusCode, response]) => ({
    key: statusCode,
    label: statusCode,
    children: (
      <div>
        <p className={styles.emptyHint}>{response.description ?? "-"}</p>
        <pre className={styles.jsonPreview}>{renderJson(response.example ?? response.schema)}</pre>
      </div>
    ),
  }));

  return (
    <div className={styles.panel}>
      {hasOpenApiIo ? (
        <>
          <section>
            <h4 className={styles.sectionTitle}>{t("executionFactory.ioParameters")}</h4>
            {ioSpec?.parameters.length ? (
              <Table
                columns={[
                  { dataIndex: "name", key: "name", title: t("executionFactory.parameterName") },
                  { dataIndex: "in", key: "in", title: t("executionFactory.globalParameterIn") },
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
                dataSource={ioSpec.parameters.map((item) => ({ ...item, key: item.name }))}
                pagination={false}
                size="small"
              />
            ) : (
              <p className={styles.emptyHint}>{t("executionFactory.noParameters")}</p>
            )}
          </section>
          <section>
            <h4 className={styles.sectionTitle}>{t("executionFactory.ioRequestBody")}</h4>
            {ioSpec?.requestBodyDescription ? (
              <p className={styles.emptyHint}>{ioSpec.requestBodyDescription}</p>
            ) : null}
            <pre className={styles.jsonPreview}>
              {renderJson(ioSpec?.requestBodyExample ?? ioSpec?.requestBodySchema)}
            </pre>
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
                <pre className={styles.jsonPreview}>{renderJson(entry.body)}</pre>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
