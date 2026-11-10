/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CopyOutlined } from "@ant-design/icons";
import { Button } from "antd";
import BigNumber from "bignumber.js";
import JSONBig from "json-bigint";
import { useMemo, useState } from "react";
import { writeTextToClipboard } from "@/framework/compat/clipboard";
import { precisionPreservingValueText } from "@/framework/request/precision-safe-json";
import { useEvalFeedback } from "./useEvalFeedback";
import { useEvalTranslation } from "./useEvalTranslation";
import styles from "./EvalResultValue.module.css";

const json = JSONBig();
const batchSize = 50;
const stringLimit = 160;
type Expansion = "default" | "all" | "none";
const structured = (value: unknown): value is Record<string, unknown> | unknown[] =>
  value !== null && typeof value === "object" && !BigNumber.isBigNumber(value);

function Scalar({ value }: { value: unknown }) {
  const { t } = useEvalTranslation();
  const [expanded, setExpanded] = useState(false);
  const text =
    typeof value === "string"
      ? JSON.stringify(expanded ? value : value.slice(0, stringLimit))
      : value === null
        ? "null"
        : precisionPreservingValueText(value);
  return (
    <>
      <span
        className={
          typeof value === "string"
            ? styles.string
            : typeof value === "boolean"
              ? styles.boolean
              : value === null
                ? styles.muted
                : styles.number
        }
      >
        {text}
        {typeof value === "string" && value.length > stringLimit && !expanded && "…"}
      </span>
      {typeof value === "string" && value.length > stringLimit && (
        <button
          type="button"
          className={styles.textButton}
          onClick={() => setExpanded((previous) => !previous)}
        >
          {t(`knowledgeNetwork.eval.resultValueUi.${expanded ? "less" : "more"}`)}
        </button>
      )}
    </>
  );
}

function ValueNode({
  value,
  name,
  depth = 0,
  expansion,
  last = true,
}: {
  value: unknown;
  name?: string;
  depth?: number;
  expansion: Expansion;
  last?: boolean;
}) {
  const { t } = useEvalTranslation();
  const [open, setOpen] = useState(expansion === "all" || (expansion === "default" && depth < 2));
  const [visible, setVisible] = useState(batchSize);
  const prefix =
    name === undefined ? null : <span className={styles.key}>{JSON.stringify(name)}: </span>;
  if (!structured(value))
    return (
      <div className={styles.line}>
        {prefix}
        <Scalar value={value} />
        {!last && ","}
      </div>
    );
  const array = Array.isArray(value);
  const entries = array
    ? value.map((item, index) => [String(index), item] as const)
    : Object.entries(value);
  const start = array ? "[" : "{";
  const end = array ? "]" : "}";
  if (!entries.length)
    return (
      <div className={styles.line}>
        {prefix}
        {start}
        {end}
        {!last && ","}
      </div>
    );
  // Stop recursive rendering for unusually deep payloads; the complete value remains copyable.
  if (depth >= 16)
    return (
      <pre className={styles.deepValue}>
        {prefix}
        {json.stringify(value, null, 2)}
      </pre>
    );
  return (
    <details
      className={styles.node}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        {prefix}
        {start}
        <span className={styles.muted}>
          {t(`knowledgeNetwork.eval.resultValueUi.${array ? "items" : "fields"}`, {
            count: entries.length,
          })}
        </span>
        {!open && (
          <>
            {end}
            {!last && ","}
          </>
        )}
      </summary>
      {open && (
        <div className={styles.children}>
          {entries.slice(0, visible).map(([key, child], index) => (
            <ValueNode
              key={key}
              value={child}
              name={array ? undefined : key}
              depth={depth + 1}
              expansion={expansion}
              last={index === entries.length - 1}
            />
          ))}
          {visible < entries.length && (
            <button
              type="button"
              className={styles.textButton}
              onClick={() => setVisible((previous) => previous + batchSize)}
            >
              {t("knowledgeNetwork.eval.resultValueUi.loadMore", {
                count: entries.length - visible,
              })}
            </button>
          )}
        </div>
      )}
      {open && (
        <div className={styles.line}>
          {end}
          {!last && ","}
        </div>
      )}
    </details>
  );
}

/** Bounded, read-only comparison value; display folding never changes the copied payload. */
export function EvalResultValue({ value, label }: { value: unknown; label: string }) {
  const { t } = useEvalTranslation();
  const { message } = useEvalFeedback();
  const [fold, setFold] = useState({ mode: "default" as Expansion, revision: 0 });
  const isStructured = structured(value);
  const raw = useMemo(
    () =>
      isStructured
        ? json.stringify(value, null, 2)
        : typeof value === "string"
          ? value
          : precisionPreservingValueText(value),
    [isStructured, value],
  );
  const l = (key: string) => t(`knowledgeNetwork.eval.resultValueUi.${key}`);
  return (
    <section className={styles.viewer} aria-label={label}>
      <div className={styles.toolbar}>
        <span className={styles.format}>{isStructured ? "JSON" : l("text")}</span>
        <div className={styles.actions}>
          {isStructured && (
            <>
              <Button
                size="small"
                type="text"
                onClick={() =>
                  setFold((previous) => ({ mode: "all", revision: previous.revision + 1 }))
                }
              >
                {l("expandAll")}
              </Button>
              <Button
                size="small"
                type="text"
                onClick={() =>
                  setFold((previous) => ({ mode: "none", revision: previous.revision + 1 }))
                }
              >
                {l("collapseAll")}
              </Button>
            </>
          )}
          <Button
            size="small"
            type="text"
            aria-label={l("copy")}
            title={l("copy")}
            icon={<CopyOutlined aria-hidden />}
            onClick={() => {
              void writeTextToClipboard(raw)
                .then(() => message.success(l("copied")))
                .catch(() => message.error(l("copyFailed")));
            }}
          />
        </div>
      </div>
      <div className={styles.content} tabIndex={0} role="region" aria-label={l("content")}>
        {isStructured ? (
          <ValueNode key={fold.revision} value={value} expansion={fold.mode} />
        ) : (
          <Scalar value={value} />
        )}
      </div>
    </section>
  );
}
