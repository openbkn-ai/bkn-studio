/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DownOutlined, RightOutlined } from "@ant-design/icons";
import { Fragment, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { precisionPreservingValueText } from "@/framework/request/precision-safe-json";
import { isDefinitionObject, objectValue, valueType } from "./model";
import styles from "./ApiVariablesTable.module.css";

const prefix = "dataConnect.apiEditor.variablesTable.";
function entries(value: unknown): [string, unknown][] {
  if (Array.isArray(value)) return value.map((entry: unknown, index) => [`[${index}]`, entry]);
  return isDefinitionObject(value) ? Object.entries(value) : [];
}
function childPath(parent: string, name: string, array: boolean): string {
  if (array) return `${parent}${name}`;
  return /^[A-Za-z_$][\w$]*$/.test(name)
    ? `${parent}.${name}`
    : `${parent}[${JSON.stringify(name)}]`;
}

/** Literal variable values are never interpreted as schema or credential metadata. */
export function ApiVariablesTable({
  variables,
  title,
}: {
  variables: Record<string, unknown>;
  title: string;
}) {
  const { t } = useTranslation();
  return (
    <div className={styles.surface}>
      <table className={`${styles.table} ${styles.variables}`} aria-label={title} role="table">
        <thead>
          <tr>
            <th scope="col">{t(`${prefix}name`)}</th>
            <th scope="col">{t(`${prefix}type`)}</th>
            <th scope="col">{t(`${prefix}sensitive`)}</th>
            <th scope="col">{t(`${prefix}value`)}</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(variables).length ? (
            Object.entries(variables).map(([name, definition]) => (
              <VariableRow key={name} name={name} definition={definition} />
            ))
          ) : (
            <tr>
              <td colSpan={4}>{t(`${prefix}emptyObject`)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function VariableRow({ name, definition }: { name: string; definition: unknown }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const record = objectValue(definition);
  const wrapped =
    isDefinitionObject(definition) &&
    (Object.hasOwn(record, "value") || Object.hasOwn(record, "sensitive"));
  const actual = wrapped ? record.value : definition;
  const sensitive = wrapped && record.sensitive === true;
  // Protected values and their structure never enter the expanded DOM.
  const expandable = !sensitive && entries(actual).length > 0;
  const additional =
    sensitive || !wrapped
      ? {}
      : Object.fromEntries(
          Object.entries(record).filter(([key]) => !["value", "sensitive"].includes(key)),
        );
  return (
    <Fragment>
      <tr>
        <th scope="row" id={`${id}-name`}>
          {name || '""'}
        </th>
        <td data-label={t(`${prefix}type`)}>
          <div>
            <ValueType value={actual} />
          </div>
        </td>
        <td data-label={t(`${prefix}sensitive`)}>
          <div>{t(`dataConnect.apiEditor.${sensitive ? "true" : "false"}`)}</div>
        </td>
        <td data-label={t(`${prefix}value`)}>
          <div>
            {sensitive ? (
              <span className={styles.protectedValue} aria-label={t(`${prefix}protected`)}>
                ••••••••
              </span>
            ) : expandable ? (
              <button
                type="button"
                className={styles.toggle}
                aria-labelledby={`${id}-name ${id}-summary`}
                aria-expanded={expanded}
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <DownOutlined aria-hidden /> : <RightOutlined aria-hidden />}
                <span id={`${id}-summary`}>
                  <LiteralValue value={actual} />
                </span>
              </button>
            ) : (
              <LiteralValue value={actual} />
            )}
          </div>
        </td>
      </tr>
      {expandable && expanded ? (
        <tr className={styles.detailRow}>
          <td colSpan={4}>
            <ValueTree value={actual} path={name} title={`${name} · ${t(`${prefix}value`)}`} />
          </td>
        </tr>
      ) : null}
      {Object.keys(additional).length ? (
        <tr className={styles.detailRow}>
          <td colSpan={4}>
            <details className={styles.additional}>
              <summary>
                {t(`${prefix}additional`)} · {name}
              </summary>
              <ValueTree
                value={additional}
                path={`${name} · ${t(`${prefix}additional`)}`}
                title={`${name} · ${t(`${prefix}additional`)}`}
              />
            </details>
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}

function ValueTree({ value, path, title }: { value: unknown; path: string; title: string }) {
  const { t } = useTranslation();
  return (
    <div className={styles.surface}>
      <table className={`${styles.table} ${styles.tree}`} role="table">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">{t(`${prefix}field`)}</th>
            <th scope="col">{t(`${prefix}type`)}</th>
            <th scope="col">{t(`${prefix}fieldValue`)}</th>
          </tr>
        </thead>
        <tbody>
          {entries(value).map(([name, entry]) => (
            <ValueRows
              key={name}
              name={name}
              path={childPath(path, name, Array.isArray(value))}
              value={entry}
              depth={0}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ValueRows({
  name,
  path,
  value,
  depth,
}: {
  name: string;
  path: string;
  value: unknown;
  depth: number;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const children = entries(value);
  return (
    <Fragment>
      <tr>
        <th scope="row" aria-label={path} title={path}>
          <span
            className={styles.fieldName}
            style={{ paddingInlineStart: `${Math.min(depth, 4) * 14}px` }}
          >
            {children.length ? (
              <button
                type="button"
                className={styles.toggle}
                aria-label={path}
                aria-expanded={expanded}
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <DownOutlined aria-hidden /> : <RightOutlined aria-hidden />}
                {name || '""'}
              </button>
            ) : (
              <span className={styles.leaf}>{name || '""'}</span>
            )}
          </span>
          {depth ? <span className={styles.mobilePath}>{path}</span> : null}
        </th>
        <td data-label={t(`${prefix}type`)}>
          <div>
            <ValueType value={value} />
          </div>
        </td>
        <td data-label={t(`${prefix}fieldValue`)}>
          <div>
            <LiteralValue value={value} />
          </div>
        </td>
      </tr>
      {expanded
        ? children.map(([name, entry]) => (
            <ValueRows
              key={name}
              name={name}
              path={childPath(path, name, Array.isArray(value))}
              value={entry}
              depth={depth + 1}
            />
          ))
        : null}
    </Fragment>
  );
}

function ValueType({ value }: { value: unknown }) {
  const { t } = useTranslation();
  return (
    <span>{value === undefined ? "—" : t(`dataConnect.apiEditor.types.${valueType(value)}`)}</span>
  );
}

function LiteralValue({ value }: { value: unknown }) {
  const { t } = useTranslation();
  if (value === undefined) return <span className={styles.hint}>{t(`${prefix}unset`)}</span>;
  if (value === "") return <span className={styles.hint}>{t(`${prefix}emptyString`)}</span>;
  if (value === null) return <code>null</code>;
  if (Array.isArray(value))
    return (
      <span>
        {value.length ? t(`${prefix}elements`, { count: value.length }) : t(`${prefix}emptyArray`)}
      </span>
    );
  if (isDefinitionObject(value)) {
    const count = Object.keys(value).length;
    return <span>{count ? t(`${prefix}properties`, { count }) : t(`${prefix}emptyObject`)}</span>;
  }
  return <span className={styles.literal}>{precisionPreservingValueText(value)}</span>;
}
