/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ClockCircleOutlined, FieldBinaryOutlined, NumberOutlined } from "@ant-design/icons";
import { Tooltip } from "antd";

import type { ResourceSchemaField } from "@/modules/data-catalog/types/data-catalog";

import styles from "./FieldIdentity.module.css";

function FieldTypeBadge({ type }: { type?: string }) {
  const normalized = type?.trim().toLowerCase() ?? "";
  let label = "?";
  let icon: "number" | "boolean" | "date" | null = null;
  if (/^(integer|int|bigint|smallint)(\b|\()/i.test(normalized)) {
    label = "int";
    icon = "number";
  } else if (/^unsigned integer(\b|\()/i.test(normalized)) {
    label = "uint";
    icon = "number";
  } else if (/^(float|double|real|number)(\b|\()/i.test(normalized)) {
    label = "float";
    icon = "number";
  } else if (/^(decimal|numeric)(\b|\()/i.test(normalized)) {
    label = "dec";
    icon = "number";
  } else if (normalized === "string") label = "Str";
  else if (normalized === "text") label = "Text";
  else if (normalized === "boolean") {
    label = "bool";
    icon = "boolean";
  } else if (["date", "time", "datetime", "timestamp"].includes(normalized)) {
    label = normalized;
    icon = "date";
  } else if (normalized === "ip") label = "IP";
  else if (normalized === "binary") label = "Bin";
  else if (normalized === "json") label = "JSON";
  else if (normalized === "point") label = "Point";
  else if (normalized === "shape") label = "Shape";
  else if (normalized === "vector") label = "Vec";
  else if (normalized === "other") label = "Other";
  else if (normalized) label = normalized;

  return (
    <span className={styles.typeBadge} title={type?.trim() || "unknown"}>
      {icon === "number" ? <NumberOutlined /> : null}
      {icon === "boolean" ? <FieldBinaryOutlined /> : null}
      {icon === "date" ? <ClockCircleOutlined /> : null}
      {icon ? <span>{label}</span> : <span>[{label}]</span>}
    </span>
  );
}

export function FieldIdentity({
  field,
  name,
  layout = "stacked",
  showNameWhenSame = false,
}: {
  field?: ResourceSchemaField;
  name: string;
  layout?: "stacked" | "inline";
  showNameWhenSame?: boolean;
}) {
  const displayName = field?.displayName?.trim() || name;
  const primary = <span className={styles.displayName}>{displayName}</span>;
  return (
    <span className={styles.identity}>
      <FieldTypeBadge type={field?.type} />
      <span className={`${styles.names} ${layout === "inline" ? styles.namesInline : ""}`}>
        {field?.description?.trim() ? (
          <Tooltip title={field.description.trim()}>{primary}</Tooltip>
        ) : (
          primary
        )}
        {showNameWhenSame || displayName !== name ? (
          <small className={styles.name}>{name}</small>
        ) : null}
      </span>
    </span>
  );
}
