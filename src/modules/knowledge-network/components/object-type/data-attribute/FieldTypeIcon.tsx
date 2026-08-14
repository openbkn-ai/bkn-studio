/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ClockCircleOutlined,
  FieldBinaryOutlined,
  NumberOutlined,
} from "@ant-design/icons";

import { DATA_PROPERTY_TYPES } from "./constants";
import styles from "./FieldTypeIcon.module.css";

type FieldTypeIconProps = {
  type?: string;
};

type DataPropertyType = (typeof DATA_PROPERTY_TYPES)[number];
type TypeIcon = "boolean" | "date" | "number";
type TypePresentation = {
  icon?: TypeIcon;
  label: string;
};

const TYPE_PRESENTATIONS = {
  string: { label: "Str" },
  text: { label: "Text" },
  integer: { icon: "number", label: "int" },
  "unsigned integer": { icon: "number", label: "uint" },
  float: { icon: "number", label: "float" },
  decimal: { icon: "number", label: "dec" },
  date: { icon: "date", label: "date" },
  time: { icon: "date", label: "time" },
  datetime: { icon: "date", label: "datetime" },
  timestamp: { icon: "date", label: "timestamp" },
  ip: { label: "IP" },
  boolean: { icon: "boolean", label: "bool" },
  binary: { label: "Bin" },
  json: { label: "JSON" },
  point: { label: "Point" },
  shape: { label: "Shape" },
  vector: { label: "Vec" },
  other: { label: "Other" },
} satisfies Record<DataPropertyType, TypePresentation>;

const TYPE_ALIASES: Record<string, DataPropertyType> = {
  bigint: "integer",
  smallint: "integer",
  double: "float",
  number: "float",
  numeric: "decimal",
  real: "float",
};

const DATA_PROPERTY_TYPE_SET = new Set<string>(DATA_PROPERTY_TYPES);

function isDataPropertyType(type: string): type is DataPropertyType {
  return DATA_PROPERTY_TYPE_SET.has(type);
}

function resolveTypePresentation(type?: string): TypePresentation {
  const normalized = type?.trim().toLowerCase() ?? "";
  const canonicalType = TYPE_ALIASES[normalized] ?? normalized;

  if (isDataPropertyType(canonicalType)) {
    return TYPE_PRESENTATIONS[canonicalType];
  }

  return { label: "Unknown" };
}

export function FieldTypeIcon({ type }: FieldTypeIconProps) {
  const { icon, label } = resolveTypePresentation(type);
  const title = type?.trim() || "unknown";

  if (icon === "number") {
    return (
      <span className={styles.typeBadge} title={title}>
        <NumberOutlined className={styles.typeBadgeIcon} />
        <span>{label}</span>
      </span>
    );
  }

  if (icon === "boolean") {
    return (
      <span className={styles.typeBadge} title={title}>
        <FieldBinaryOutlined className={styles.typeBadgeIcon} />
        <span>{label}</span>
      </span>
    );
  }

  if (icon === "date") {
    return (
      <span className={styles.typeBadge} title={title}>
        <ClockCircleOutlined className={styles.dateIcon} />
        <span>{label}</span>
      </span>
    );
  }

  return (
    <span className={styles.typeBadge} title={title}>
      [{label}]
    </span>
  );
}
