/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Empty, Space, Tabs, Tag } from "antd";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { precisionPreservingValueText } from "@/framework/request/precision-safe-json";
import { isDefinitionObject, objectValue } from "@/shared/api-definition/model";
import { ApiVariablesTable } from "@/shared/api-definition/ApiVariablesTable";
import { ApiDefinitionFieldTable } from "@/shared/api-definition/ApiDefinitionFieldTable";
import { humanizeConnectorFieldLabel } from "../lib/connector-template";
import drawerStyles from "./DataConnectDetailDrawer.module.css";
import styles from "./ApiCatalogConfigDetails.module.css";

/** Only declared sensitive variable values are masked in connection details. */
export function ApiCatalogConfigDetails({ config }: { config: Record<string, unknown> }) {
  const { t } = useTranslation();
  if (!Object.keys(config).length)
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={t("dataConnect.noConnectorConfig")}
      />
    );
  const variables = objectValue(config.variables);
  const options = objectValue(config.options);
  const additional = Object.fromEntries(
    Object.entries(config).filter(
      ([key]) => !["base_url", "variables", "options", "login_request"].includes(key),
    ),
  );
  const itemClass = `${drawerStyles.configItem} ${drawerStyles.configItemFull}`;
  const labels: Record<string, string> = {
    request: "dataConnect.apiEditor.request",
    response: "dataConnect.apiEditor.response",
    success_rule: "dataConnect.apiEditor.success",
    method: "dataConnect.apiEditor.method",
    path: "dataConnect.apiEditor.path",
    headers: "dataConnect.apiEditor.headers",
    parameters: "dataConnect.apiEditor.parameters",
    body: "dataConnect.apiEditor.body",
    content_type: "dataConnect.apiEditor.mediaType",
    statuses: "dataConnect.apiEditor.responseStatus",
    http_status: "dataConnect.apiEditor.allowedStatuses",
    body_filter_condition: "dataConnect.apiEditor.condition",
  };
  const label = (name: string) => (Object.hasOwn(labels, name) ? t(labels[name]) : name);
  return (
    <div className={`${drawerStyles.configGrid} ${styles.layout}`}>
      <div className={itemClass}>
        <span className={drawerStyles.configLabel}>{t("dataConnect.apiCatalog.baseUrl")}</span>
        <span className={drawerStyles.configValue}>
          {typeof config.base_url === "string" && config.base_url ? config.base_url : "-"}
        </span>
      </div>
      <div className={itemClass}>
        <span className={drawerStyles.configLabel}>
          {humanizeConnectorFieldLabel("options", "http")}
        </span>
        {Object.keys(options).length ? (
          <Space size={[4, 4]} wrap>
            {Object.entries(options).map(([name, value]) => (
              <Tag key={name}>
                {name}: <ConfigValue value={value} />
              </Tag>
            ))}
          </Space>
        ) : (
          <span className={drawerStyles.configValue}>
            {t("dataConnect.apiCatalog.details.defaultLimits")}
          </span>
        )}
      </div>
      <div className={itemClass}>
        <span className={drawerStyles.configLabel}>{t("dataConnect.apiCatalog.variables")}</span>
        {Object.keys(variables).length ? (
          <ApiVariablesTable variables={variables} title={t("dataConnect.apiCatalog.variables")} />
        ) : (
          <span className={drawerStyles.configValue}>
            {t("dataConnect.apiCatalog.noVariables")}
          </span>
        )}
      </div>
      <div className={itemClass}>
        <span className={drawerStyles.configLabel}>{t("dataConnect.apiCatalog.login")}</span>
        {config.login_request !== undefined && config.login_request !== null ? (
          <details className={styles.login}>
            <summary>{t("dataConnect.apiCatalog.details.loginConfigured")}</summary>
            {isDefinitionObject(config.login_request) &&
            Object.keys(config.login_request).length ? (
              Object.entries(config.login_request).map(([name, value]) =>
                name === "response" ? (
                  <LoginResponseDetails
                    key={name}
                    title={label(name)}
                    value={value}
                    label={label}
                  />
                ) : (
                  <LoginConfigTable
                    key={name}
                    title={label(name)}
                    value={value}
                    label={label}
                    isRequest={name === "request"}
                  />
                ),
              )
            ) : (
              <ConfigValue value={config.login_request} />
            )}
          </details>
        ) : (
          <span className={drawerStyles.configValue}>
            {t("dataConnect.apiCatalog.details.noLogin")}
          </span>
        )}
      </div>
      {Object.keys(additional).length ? (
        <div className={itemClass}>
          <details className={styles.login}>
            <summary>{t("dataConnect.apiCatalog.details.additional")}</summary>
            <ConfigValue value={additional} />
          </details>
        </div>
      ) : null}
    </div>
  );
}

function LoginConfigTable({
  title,
  value,
  label,
  isRequest = false,
}: {
  title: string;
  value: unknown;
  label: (name: string) => string;
  isRequest?: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  const definition = objectValue(value);
  const parameters =
    isRequest && Array.isArray(definition.parameters) ? definition.parameters : undefined;
  const hasBody = isRequest && Object.hasOwn(definition, "body");
  const rows: { name: string; path: string; value: unknown; depth: number; branch: boolean }[] = [];
  const append = (name: string, entry: unknown, path: string, depth: number) => {
    const children = Array.isArray(entry)
      ? entry.map((child: unknown, index) => [`[${index}]`, child] as const)
      : isDefinitionObject(entry)
        ? Object.entries(entry)
        : [];
    rows.push({ name, path, value: entry, depth, branch: children.length > 0 });
    for (const [childName, child] of children)
      append(childName, child, `${path}${Array.isArray(entry) ? "" : "."}${childName}`, depth + 1);
  };
  if (isDefinitionObject(value)) {
    for (const [name, entry] of Object.entries(value)) {
      if ((name === "parameters" && parameters !== undefined) || (name === "body" && hasBody))
        continue;
      append(name, entry, name, 0);
    }
  }
  if (!rows.length && parameters === undefined && !hasBody) append(title, value, title, 0);
  return (
    <div className={styles.loginGroup}>
      <h4 id={id} className={styles.loginGroupTitle}>
        {title}
      </h4>
      {rows.length ? (
        <div className={styles.tableContainer}>
          <table
            className={`${styles.variableTable} ${styles.definitionTable}`}
            aria-labelledby={id}
          >
            <thead>
              <tr>
                <th scope="col">{t("dataConnect.apiCatalog.details.field")}</th>
                <th scope="col">{t("dataConnect.apiEditor.value")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className={row.branch ? styles.branchRow : undefined}>
                  <th scope="row" aria-label={row.path} title={row.path}>
                    <span
                      style={{ paddingInlineStart: `${Math.min(row.depth, 4) * 12}px` }}
                      className={styles.fieldName}
                    >
                      {row.depth === 0 ? label(row.name) : row.name}
                    </span>
                  </th>
                  <td>
                    {row.branch ? (
                      <span className={styles.hint}>
                        {t(
                          `dataConnect.apiEditor.types.${Array.isArray(row.value) ? "array" : "object"}`,
                        )}
                      </span>
                    ) : (
                      <ConfigValue value={row.value} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {parameters !== undefined ? <QueryParametersTable parameters={parameters} /> : null}
      {hasBody ? (
        <div className={styles.loginGroup}>
          <ApiDefinitionFieldTable
            title={t("dataConnect.apiEditor.body")}
            value={definition.body}
            mode="body"
            renderValue={(value) => <ConfigValue value={value} booleanLiteral />}
          />
        </div>
      ) : null}
    </div>
  );
}

function LoginResponseDetails({
  title,
  value,
  label,
}: {
  title: string;
  value: unknown;
  label: (name: string) => string;
}) {
  const { t } = useTranslation();
  const definition = objectValue(value);
  const statuses = objectValue(definition.statuses);
  const general = Object.fromEntries(
    Object.entries(definition).filter(([key]) => key !== "statuses"),
  );
  return (
    <div className={styles.loginGroup}>
      {Object.keys(general).length ||
      !isDefinitionObject(value) ||
      !Object.keys(definition).length ? (
        <LoginConfigTable
          title={title}
          value={isDefinitionObject(value) ? general : value}
          label={label}
        />
      ) : null}
      {Object.keys(statuses).length ? (
        <Tabs
          className={styles.statusTabs}
          size="small"
          ref={(tabs) => {
            tabs?.nativeElement
              ?.querySelector('[role="tablist"]')
              ?.setAttribute("aria-label", t("dataConnect.apiEditor.responseStatus"));
          }}
          items={Object.entries(statuses).map(([status, value]) => {
            const response = objectValue(value);
            const fields = Object.fromEntries(
              Object.entries(response).filter(([key]) => !["headers", "schema"].includes(key)),
            );
            return {
              key: status,
              label: status,
              children: (
                <div className={styles.loginSections}>
                  <LoginConfigTable
                    title={`${t("dataConnect.apiEditor.responseStatus")} ${status}`}
                    value={isDefinitionObject(value) ? fields : value}
                    label={label}
                  />
                  {Object.hasOwn(response, "headers") ? (
                    <LoginConfigTable
                      title={`${status} ${t("dataConnect.apiEditor.responseHeaders")}`}
                      value={response.headers}
                      label={(key) => key}
                    />
                  ) : null}
                  {Object.hasOwn(response, "schema") ? (
                    <ApiDefinitionFieldTable
                      title={`${status} ${t("dataConnect.apiEditor.response")}`}
                      value={response.schema}
                      mode="schema"
                      renderValue={(value) => <ConfigValue value={value} booleanLiteral />}
                    />
                  ) : null}
                </div>
              ),
            };
          })}
        />
      ) : null}
      {Object.hasOwn(definition, "statuses") && !Object.keys(statuses).length ? (
        <LoginConfigTable
          title={t("dataConnect.apiEditor.responseStatus")}
          value={definition.statuses}
          label={label}
        />
      ) : null}
    </div>
  );
}

function QueryParametersTable({ parameters }: { parameters: unknown[] }) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className={styles.loginGroup}>
      <h5 id={id} className={styles.loginGroupTitle}>
        {t("dataConnect.apiEditor.parameters")}
      </h5>
      <table className={`${styles.variableTable} ${styles.queryTable}`} aria-labelledby={id}>
        <thead>
          <tr>
            <th scope="col">{t("dataConnect.apiEditor.parameterName")}</th>
            <th scope="col">{t("dataConnect.apiEditor.parameterValue")}</th>
            <th scope="col">{t("dataConnect.apiEditor.defaultValue")}</th>
            <th scope="col">{t("dataConnect.apiEditor.required")}</th>
          </tr>
        </thead>
        <tbody>
          {parameters.length ? (
            parameters.map((entry, index) => {
              const parameter = objectValue(entry);
              const additional = Object.fromEntries(
                Object.entries(parameter).filter(
                  ([name]) => !["name", "value", "default_value", "required"].includes(name),
                ),
              );
              return (
                <tr key={index}>
                  <th scope="row">
                    <ConfigValue value={parameter.name} />
                  </th>
                  <td>
                    <ConfigValue value={isDefinitionObject(entry) ? parameter.value : entry} />
                    {Object.keys(additional).length ? (
                      <details>
                        <summary>{t("dataConnect.apiCatalog.details.additional")}</summary>
                        <ConfigValue value={additional} />
                      </details>
                    ) : null}
                  </td>
                  <td>
                    <ConfigValue value={parameter.default_value} />
                  </td>
                  <td>
                    <ConfigValue value={parameter.required} />
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={4}>
                <ConfigValue value={parameters} />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ConfigValue({
  value,
  label = (name) => name,
  booleanLiteral = false,
}: {
  value: unknown;
  label?: (name: string) => string;
  booleanLiteral?: boolean;
}) {
  const { t } = useTranslation();
  if (Array.isArray(value))
    return value.length ? (
      <ol className={styles.array}>
        {value.map((entry: unknown, index) => (
          <li key={index}>
            <ConfigValue value={entry} label={label} booleanLiteral={booleanLiteral} />
          </li>
        ))}
      </ol>
    ) : (
      <span>{t("dataConnect.apiCatalog.details.emptyArray")}</span>
    );
  if (isDefinitionObject(value))
    return Object.keys(value).length ? (
      <dl className={styles.nestedFields}>
        {Object.entries(value).map(([name, entry]) => (
          <div key={name}>
            <dt>{label(name)}</dt>
            <dd>
              <ConfigValue value={entry} label={label} booleanLiteral={booleanLiteral} />
            </dd>
          </div>
        ))}
      </dl>
    ) : (
      <span>{t("dataConnect.apiCatalog.details.emptyObject")}</span>
    );
  if (typeof value === "boolean")
    return (
      <span>
        {booleanLiteral ? String(value) : t(`dataConnect.apiEditor.${value ? "true" : "false"}`)}
      </span>
    );
  if (value === null) return <span>null</span>;
  if (value === undefined) return <span>—</span>;
  if (value === "")
    return <span className={styles.hint}>{t("dataConnect.apiCatalog.details.emptyString")}</span>;
  return <span className={styles.value}>{precisionPreservingValueText(value)}</span>;
}
