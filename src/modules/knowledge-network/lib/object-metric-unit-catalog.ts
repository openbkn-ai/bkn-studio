/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ObjectMetricDefinitionV1 } from "@/modules/knowledge-network/types/object-metric";
import type { objectMetricV1Part } from "@/modules/knowledge-network/locales/zh-CN/object-metric-v1";
import { objectMetricText } from "@/modules/knowledge-network/lib/object-metric-text";

export type ObjectMetricUnitQuantityKind =
  | "dimensionless"
  | "count"
  | "currency"
  | "duration"
  | "data_size"
  | "rate"
  | "weight"
  | "length"
  | "area"
  | "volume"
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
  {
    code: "1",
    get label() {
      return objectMetricText("m0e3460b4c11c");
    },
    quantityKind: "dimensionless",
    scaleFactor: 1,
    system: "UCUM",
  },
  {
    code: "%",
    get label() {
      return objectMetricText("m5b06f7c857a2");
    },
    quantityKind: "dimensionless",
    scaleFactor: 1,
    system: "UCUM",
  },

  {
    code: "1",
    get label() {
      return objectMetricText("mef36c66ef41e");
    },
    quantityKind: "count",
    scaleFactor: 1,
    system: "UCUM",
  },
  {
    code: "item",
    get label() {
      return objectMetricText("m0c1a77cf21d1");
    },
    quantityKind: "count",
    scaleFactor: 1,
    system: "registered",
  },
  {
    code: "order",
    get label() {
      return objectMetricText("mc968a3be70f6");
    },
    quantityKind: "count",
    scaleFactor: 1,
    system: "registered",
  },
  {
    code: "person",
    get label() {
      return objectMetricText("m5b0762a27516");
    },
    quantityKind: "count",
    scaleFactor: 1,
    system: "registered",
  },
  {
    code: "record",
    get label() {
      return objectMetricText("m886776baa648");
    },
    quantityKind: "count",
    scaleFactor: 1,
    system: "registered",
  },
  {
    code: "occurrence",
    get label() {
      return objectMetricText("mded051219c76");
    },
    quantityKind: "count",
    scaleFactor: 1,
    system: "registered",
  },

  {
    code: "CNY",
    get label() {
      return objectMetricText("mb7f00f7e4fe4");
    },
    quantityKind: "currency",
    scaleFactor: 1,
    system: "ISO_4217",
  },
  {
    code: "USD",
    get label() {
      return objectMetricText("mbd487b0fa4d3");
    },
    quantityKind: "currency",
    scaleFactor: 1,
    system: "ISO_4217",
  },
  {
    code: "EUR",
    get label() {
      return objectMetricText("mbdb877468b8e");
    },
    quantityKind: "currency",
    scaleFactor: 1,
    system: "ISO_4217",
  },
  {
    code: "JPY",
    get label() {
      return objectMetricText("m8f7a1781b918");
    },
    quantityKind: "currency",
    scaleFactor: 1,
    system: "ISO_4217",
  },
  {
    code: "HKD",
    get label() {
      return objectMetricText("m95d8a4e9ae1f");
    },
    quantityKind: "currency",
    scaleFactor: 1,
    system: "ISO_4217",
  },
  {
    code: "GBP",
    get label() {
      return objectMetricText("m76e07b294bb4");
    },
    quantityKind: "currency",
    scaleFactor: 1,
    system: "ISO_4217",
  },

  {
    code: "ms",
    get label() {
      return objectMetricText("m9aabbbf25cea");
    },
    quantityKind: "duration",
    scaleFactor: 1,
    system: "UCUM",
  },
  {
    code: "s",
    get label() {
      return objectMetricText("m3f6f70f87717");
    },
    quantityKind: "duration",
    scaleFactor: 1,
    system: "UCUM",
  },
  {
    code: "min",
    get label() {
      return objectMetricText("m9dbb4567873e");
    },
    quantityKind: "duration",
    scaleFactor: 1,
    system: "UCUM",
  },
  {
    code: "h",
    get label() {
      return objectMetricText("m4b9e00763164");
    },
    quantityKind: "duration",
    scaleFactor: 1,
    system: "UCUM",
  },
  {
    code: "d",
    get label() {
      return objectMetricText("m6b6621262f63");
    },
    quantityKind: "duration",
    scaleFactor: 1,
    system: "UCUM",
  },

  {
    code: "mg",
    get label() {
      return objectMetricText("maf1405fb0f94");
    },
    quantityKind: "weight",
    scaleFactor: 1,
    system: "UCUM",
  },
  {
    code: "g",
    get label() {
      return objectMetricText("md69a38953356");
    },
    quantityKind: "weight",
    scaleFactor: 1,
    system: "UCUM",
  },
  {
    code: "kg",
    get label() {
      return objectMetricText("m82f07ca38fec");
    },
    quantityKind: "weight",
    scaleFactor: 1,
    system: "UCUM",
  },
  {
    code: "t",
    get label() {
      return objectMetricText("m72b97029cfbf");
    },
    quantityKind: "weight",
    scaleFactor: 1,
    system: "UCUM",
  },

  {
    code: "mm",
    get label() {
      return objectMetricText("m5f0d4fc6545d");
    },
    quantityKind: "length",
    scaleFactor: 1,
    system: "UCUM",
  },
  {
    code: "cm",
    get label() {
      return objectMetricText("m879030313976");
    },
    quantityKind: "length",
    scaleFactor: 1,
    system: "UCUM",
  },
  {
    code: "m",
    get label() {
      return objectMetricText("m821d6a8b01ed");
    },
    quantityKind: "length",
    scaleFactor: 1,
    system: "UCUM",
  },
  {
    code: "km",
    get label() {
      return objectMetricText("m18dc79b1c5af");
    },
    quantityKind: "length",
    scaleFactor: 1,
    system: "UCUM",
  },

  {
    code: "m2",
    get label() {
      return objectMetricText("unitSquareMeter");
    },
    quantityKind: "area",
    scaleFactor: 1,
    system: "UCUM",
  },
  {
    code: "km2",
    get label() {
      return objectMetricText("unitSquareKilometer");
    },
    quantityKind: "area",
    scaleFactor: 1,
    system: "UCUM",
  },

  {
    code: "L",
    get label() {
      return objectMetricText("unitLiter");
    },
    quantityKind: "volume",
    scaleFactor: 1,
    system: "UCUM",
  },
  {
    code: "m3",
    get label() {
      return objectMetricText("unitCubicMeter");
    },
    quantityKind: "volume",
    scaleFactor: 1,
    system: "UCUM",
  },

  {
    code: "B",
    get label() {
      return objectMetricText("m569c00bfad06");
    },
    quantityKind: "data_size",
    scaleFactor: 1,
    system: "UCUM",
  },
  {
    code: "kB",
    get label() {
      return objectMetricText("ma55b69b0b0e2");
    },
    quantityKind: "data_size",
    scaleFactor: 1,
    system: "UCUM",
  },
  {
    code: "MB",
    get label() {
      return objectMetricText("m15468df44a6c");
    },
    quantityKind: "data_size",
    scaleFactor: 1,
    system: "UCUM",
  },
  {
    code: "GB",
    get label() {
      return objectMetricText("ma4a07e19bb13");
    },
    quantityKind: "data_size",
    scaleFactor: 1,
    system: "UCUM",
  },
  {
    code: "TB",
    get label() {
      return objectMetricText("m744fb5d8080a");
    },
    quantityKind: "data_size",
    scaleFactor: 1,
    system: "UCUM",
  },
];

function allowedQuantityKinds(semanticType?: SemanticType, physicalType?: PhysicalType) {
  if (physicalType === "duration" || semanticType === "duration") return new Set(["duration"]);
  if (semanticType === "amount") return new Set(["currency"]);
  if (semanticType === "count") return new Set(["count"]);
  if (["percentage", "ratio", "rank", "score"].includes(semanticType ?? "")) {
    return new Set(["dimensionless"]);
  }
  if (semanticType === "measure") {
    return new Set(["dimensionless", "weight", "length", "area", "volume", "data_size"]);
  }
  return new Set<string>();
}

export function objectMetricUnitOptions(
  semanticType?: SemanticType,
  physicalType?: PhysicalType,
  current?: Partial<ObjectMetricUnitOption>,
  supportedQuantityKinds?: readonly string[],
) {
  const allowedKinds = allowedQuantityKinds(semanticType, physicalType);
  let options = unitCatalog.filter(
    (item) =>
      allowedKinds.has(item.quantityKind) &&
      (!supportedQuantityKinds || supportedQuantityKinds.includes(item.quantityKind)),
  );

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
        label: objectMetricText("m5d2f6bfa96cf", { p0: current.code }),
        quantityKind: current.quantityKind,
        scaleFactor: current.scaleFactor ?? 1,
        system: current.system,
      },
    ];
  }

  return options;
}

const unitGroupKeys: Record<ObjectMetricUnitQuantityKind, keyof typeof objectMetricV1Part> = {
  dimensionless: "unitGroupDimensionless",
  count: "unitGroupCount",
  currency: "unitGroupCurrency",
  duration: "unitGroupDuration",
  data_size: "unitGroupDataSize",
  rate: "unitGroupRate",
  weight: "unitGroupWeight",
  length: "unitGroupLength",
  area: "unitGroupArea",
  volume: "unitGroupVolume",
  custom: "unitGroupCustom",
};

export function objectMetricUnitOptionGroups(options: readonly ObjectMetricUnitOption[]) {
  const groups: Array<{
    label: string;
    options: Array<{ label: string; value: string }>;
  }> = [];
  const byKind = new Map<ObjectMetricUnitQuantityKind, (typeof groups)[number]>();
  for (const option of options) {
    let group = byKind.get(option.quantityKind);
    if (!group) {
      group = { label: objectMetricText(unitGroupKeys[option.quantityKind]), options: [] };
      byKind.set(option.quantityKind, group);
      groups.push(group);
    }
    group.options.push({ label: option.label, value: option.code });
  }
  return groups;
}

export function objectMetricUnitSelectionLocked(semanticType?: SemanticType) {
  return ["percentage", "ratio", "rank", "score"].includes(semanticType ?? "");
}
