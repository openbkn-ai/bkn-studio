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

import styles from "./FieldTypeIcon.module.css";

type FieldTypeIconProps = {
  type?: string;
};

function getFieldTypeLabel(type?: string) {
  const normalized = (type ?? "string").toLowerCase();

  if (
    normalized === "integer" ||
    normalized === "unsigned integer" ||
    normalized === "bigint" ||
    normalized === "smallint"
  ) {
    return "int";
  }

  if (
    normalized === "float" ||
    normalized === "double" ||
    normalized === "decimal" ||
    normalized === "number" ||
    normalized === "numeric" ||
    normalized === "real"
  ) {
    return "float";
  }

  if (normalized === "boolean") {
    return "bool";
  }

  if (normalized === "vector") {
    return "vec";
  }

  if (normalized === "text") {
    return "text";
  }

  return "Str";
}

function isDateLikeType(type?: string) {
  const normalized = (type ?? "").toLowerCase();
  return ["date", "datetime", "time", "timestamp"].includes(normalized);
}

export function FieldTypeIcon({ type }: FieldTypeIconProps) {
  if (isDateLikeType(type)) {
    return <ClockCircleOutlined className={styles.dateIcon} />;
  }

  const label = getFieldTypeLabel(type);

  if (label === "int" || label === "float") {
    return (
      <span className={styles.typeBadge} title={type}>
        <NumberOutlined className={styles.typeBadgeIcon} />
        <span>{label}</span>
      </span>
    );
  }

  if (label === "bool") {
    return (
      <span className={styles.typeBadge} title={type}>
        <FieldBinaryOutlined className={styles.typeBadgeIcon} />
        <span>bool</span>
      </span>
    );
  }

  return (
    <span className={styles.typeBadge} title={type}>
      [{label}]
    </span>
  );
}
