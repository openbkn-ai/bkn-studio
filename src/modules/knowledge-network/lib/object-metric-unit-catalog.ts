/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ObjectMetricDefinitionV1 } from "@/modules/knowledge-network/types/object-metric";

export type ObjectMetricUnitQuantityKind =
  | "dimensionless"
  | "count"
  | "currency"
  | "duration"
  | "data_size"
  | "rate"
  | "weight"
  | "length"
  | "custom";

export type ObjectMetricUnitSystem = "UCUM" | "ISO_4217" | "registered";

export type ObjectMetricUnitOption = {
  code: string;
  label: string;
  quantityKind: ObjectMetricUnitQuantityKind;
  scaleFactor: number;
  system: ObjectMetricUnitSystem;
};

type SemanticType = ObjectMetricDefinitionV1["result_semantics"]["value"]["semantic_type"];
type PhysicalType = ObjectMetricDefinitionV1["result_semantics"]["value"]["physical_type"];

const unitCatalog: ObjectMetricUnitOption[] = [
  { code: "1", label: "无量纲 · 1", quantityKind: "dimensionless", scaleFactor: 1, system: "UCUM" },
  { code: "%", label: "百分比 · %", quantityKind: "dimensionless", scaleFactor: 1, system: "UCUM" },

  { code: "1", label: "通用计数 · 1", quantityKind: "count", scaleFactor: 1, system: "UCUM" },
  { code: "item", label: "件 · item", quantityKind: "count", scaleFactor: 1, system: "registered" },
  {
    code: "order",
    label: "订单 · order",
    quantityKind: "count",
    scaleFactor: 1,
    system: "registered",
  },
  {
    code: "person",
    label: "人 · person",
    quantityKind: "count",
    scaleFactor: 1,
    system: "registered",
  },
  {
    code: "record",
    label: "条 · record",
    quantityKind: "count",
    scaleFactor: 1,
    system: "registered",
  },
  {
    code: "occurrence",
    label: "次 · occurrence",
    quantityKind: "count",
    scaleFactor: 1,
    system: "registered",
  },

  {
    code: "CNY",
    label: "人民币元 · CNY",
    quantityKind: "currency",
    scaleFactor: 1,
    system: "ISO_4217",
  },
  {
    code: "USD",
    label: "美元 · USD",
    quantityKind: "currency",
    scaleFactor: 1,
    system: "ISO_4217",
  },
  {
    code: "EUR",
    label: "欧元 · EUR",
    quantityKind: "currency",
    scaleFactor: 1,
    system: "ISO_4217",
  },
  {
    code: "JPY",
    label: "日元 · JPY",
    quantityKind: "currency",
    scaleFactor: 1,
    system: "ISO_4217",
  },
  {
    code: "HKD",
    label: "港元 · HKD",
    quantityKind: "currency",
    scaleFactor: 1,
    system: "ISO_4217",
  },
  {
    code: "GBP",
    label: "英镑 · GBP",
    quantityKind: "currency",
    scaleFactor: 1,
    system: "ISO_4217",
  },

  { code: "ms", label: "毫秒 · ms", quantityKind: "duration", scaleFactor: 1, system: "UCUM" },
  { code: "s", label: "秒 · s", quantityKind: "duration", scaleFactor: 1, system: "UCUM" },
  { code: "min", label: "分钟 · min", quantityKind: "duration", scaleFactor: 1, system: "UCUM" },
  { code: "h", label: "小时 · h", quantityKind: "duration", scaleFactor: 1, system: "UCUM" },
  { code: "d", label: "天 · d", quantityKind: "duration", scaleFactor: 1, system: "UCUM" },

  { code: "mg", label: "毫克 · mg", quantityKind: "weight", scaleFactor: 1, system: "UCUM" },
  { code: "g", label: "克 · g", quantityKind: "weight", scaleFactor: 1, system: "UCUM" },
  { code: "kg", label: "千克 · kg", quantityKind: "weight", scaleFactor: 1, system: "UCUM" },
  { code: "t", label: "吨 · t", quantityKind: "weight", scaleFactor: 1, system: "UCUM" },

  { code: "mm", label: "毫米 · mm", quantityKind: "length", scaleFactor: 1, system: "UCUM" },
  { code: "cm", label: "厘米 · cm", quantityKind: "length", scaleFactor: 1, system: "UCUM" },
  { code: "m", label: "米 · m", quantityKind: "length", scaleFactor: 1, system: "UCUM" },
  { code: "km", label: "千米 · km", quantityKind: "length", scaleFactor: 1, system: "UCUM" },

  { code: "B", label: "字节 · B", quantityKind: "data_size", scaleFactor: 1, system: "UCUM" },
  { code: "kB", label: "千字节 · kB", quantityKind: "data_size", scaleFactor: 1, system: "UCUM" },
  { code: "MB", label: "兆字节 · MB", quantityKind: "data_size", scaleFactor: 1, system: "UCUM" },
  { code: "GB", label: "吉字节 · GB", quantityKind: "data_size", scaleFactor: 1, system: "UCUM" },
  { code: "TB", label: "太字节 · TB", quantityKind: "data_size", scaleFactor: 1, system: "UCUM" },
];

function allowedQuantityKinds(semanticType?: SemanticType, physicalType?: PhysicalType) {
  if (physicalType === "duration" || semanticType === "duration") return new Set(["duration"]);
  if (semanticType === "amount") return new Set(["currency"]);
  if (semanticType === "count") return new Set(["count"]);
  if (["percentage", "ratio", "rank", "score"].includes(semanticType ?? "")) {
    return new Set(["dimensionless"]);
  }
  if (semanticType === "measure") {
    return new Set(["dimensionless", "weight", "length", "data_size"]);
  }
  return new Set<string>();
}

export function objectMetricUnitOptions(
  semanticType?: SemanticType,
  physicalType?: PhysicalType,
  current?: Partial<ObjectMetricUnitOption>,
) {
  const allowedKinds = allowedQuantityKinds(semanticType, physicalType);
  let options = unitCatalog.filter((item) => allowedKinds.has(item.quantityKind));

  if (semanticType === "percentage") {
    options = options.filter((item) => item.code === "%");
  } else if (["ratio", "rank", "score"].includes(semanticType ?? "")) {
    options = options.filter((item) => item.code === "1");
  }

  if (
    current?.code &&
    current.system &&
    current.quantityKind &&
    !options.some((item) => item.code === current.code)
  ) {
    options = [
      ...options,
      {
        code: current.code,
        label: `${current.code} · 已有单位`,
        quantityKind: current.quantityKind,
        scaleFactor: current.scaleFactor ?? 1,
        system: current.system,
      },
    ];
  }

  return options;
}

export function objectMetricUnitSelectionLocked(semanticType?: SemanticType) {
  return ["percentage", "ratio", "rank", "score"].includes(semanticType ?? "");
}
