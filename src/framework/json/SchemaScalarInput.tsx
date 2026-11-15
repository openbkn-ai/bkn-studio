/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Input, InputNumber, Select } from "antd";
import BigNumber from "bignumber.js";
import { parsePrecisionPreservingJSON } from "@/framework/request/precision-safe-json";
import { jsonValueText } from "./json-value-text";
import { JsonInput } from "./JsonInput";

export type ScalarInputLabels = {
  boolean: string;
  enum: string;
  integer: string;
  number: string;
  string: string;
  yes: string;
  no: string;
};

type Props = {
  name: string;
  schema: Record<string, unknown>;
  value: unknown;
  onChange: (value: unknown) => void;
  onJsonChange: (text: string) => void;
  labels: ScalarInputLabels;
};

/** Edit values only. Contract validation and missing-value policy belong to the caller. */
export function SchemaScalarInput({ name, schema, value, onChange, onJsonChange, labels }: Props) {
  const type = String(schema.type);
  const representable =
    value === undefined ||
    (type === "string"
      ? typeof value === "string"
      : type === "boolean"
        ? typeof value === "boolean"
        : ["number", "integer"].includes(type) &&
          (typeof value === "number" || BigNumber.isBigNumber(value)));
  if (!representable)
    return (
      <JsonInput
        ariaLabel={name}
        height={96}
        value={jsonValueText(value)}
        schema={schema}
        onChange={onJsonChange}
      />
    );
  if (type === "boolean")
    return (
      <Select
        aria-label={name}
        style={{ width: "100%" }}
        allowClear
        value={value}
        placeholder={labels.boolean}
        options={[
          { value: true, label: labels.yes },
          { value: false, label: labels.no },
        ].filter((option) => !Array.isArray(schema.enum) || schema.enum.includes(option.value))}
        onChange={onChange}
      />
    );
  if (Array.isArray(schema.enum))
    return (
      <Select
        aria-label={name}
        style={{ width: "100%" }}
        allowClear
        value={value}
        placeholder={labels.enum}
        options={schema.enum.map((v: unknown) => ({ value: v, label: String(v) }))}
        onChange={onChange}
      />
    );
  if (["integer", "number"].includes(type))
    return (
      <InputNumber<string>
        aria-label={name}
        stringMode
        style={{ width: "100%" }}
        placeholder={type === "integer" ? labels.integer : labels.number}
        value={
          typeof value === "number" || BigNumber.isBigNumber(value) ? String(value) : undefined
        }
        onChange={(v) =>
          onChange(v === null || v === "" ? undefined : parsePrecisionPreservingJSON(v))
        }
      />
    );
  return (
    <Input
      aria-label={name}
      placeholder={labels.string}
      value={typeof value === "string" ? value : ""}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
