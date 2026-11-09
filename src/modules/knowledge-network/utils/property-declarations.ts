/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  ObjectTypeDataProperty,
  PropertyConstraints,
  PropertyCrs,
  PropertyDeclarations,
  PropertyLengthRange,
  PropertySemantic,
  PropertyValueRange,
  ValueType,
  ValueTypeKind,
} from "@/modules/knowledge-network/types/knowledge-network";

// The rules below follow bkn-specification (SPECIFICATION.md §6.8, §16), which the backend runs on
// every save. Studio checks the ones that need only the definition being edited, so the form
// refuses them before a save does.

export const PROPERTY_SEMANTICS: readonly PropertySemantic[] = [
  "event_time",
  "end_time",
  "valid_from",
  "valid_to",
  "location",
  "latitude",
  "longitude",
  "status",
  "severity",
];

export const PROPERTY_CRS_VALUES: readonly PropertyCrs[] = ["wgs84", "gcj02", "bd09"];

export const MAX_PROPERTY_ALIASES = 10;
export const MAX_ALIAS_LENGTH = 40;
/** The commas an alias cannot hold: they separate aliases where they are written as one cell. */
export const ALIAS_SEPARATORS = [",", "\uFF0C"] as const;

const DATE_TYPES = ["date", "datetime", "timestamp"];
const NUMERIC_TYPES = ["integer", "unsigned integer", "float", "decimal"];
const STRING_TYPES = ["string", "keyword", "text"];
const NOT_UNIQUE_TYPES = ["json", "binary", "vector", "point", "shape"];
const LOCATED_SEMANTICS: readonly PropertySemantic[] = ["location", "latitude", "longitude"];

const SEMANTIC_TYPES: Record<PropertySemantic, readonly string[]> = {
  end_time: DATE_TYPES,
  event_time: DATE_TYPES,
  latitude: ["float", "decimal"],
  location: ["point", "shape"],
  longitude: ["float", "decimal"],
  severity: ["string", "keyword", "integer"],
  status: ["string", "keyword", "integer"],
  valid_from: DATE_TYPES,
  valid_to: DATE_TYPES,
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export const normalizePropertyType = (type?: string) => (type ?? "").trim().toLowerCase();

export const isPropertySemantic = (value: unknown): value is PropertySemantic =>
  typeof value === "string" && (PROPERTY_SEMANTICS as readonly string[]).includes(value);

export const isPropertyCrs = (value: unknown): value is PropertyCrs =>
  typeof value === "string" && (PROPERTY_CRS_VALUES as readonly string[]).includes(value);

/** The Semantic values a property of this type can declare. */
export function semanticsForType(type?: string): PropertySemantic[] {
  const normalized = normalizePropertyType(type);
  return PROPERTY_SEMANTICS.filter((semantic) => SEMANTIC_TYPES[semantic].includes(normalized));
}

export const crsApplies = (semantic?: PropertySemantic) =>
  Boolean(semantic && LOCATED_SEMANTICS.includes(semantic));

/** How a range of this type is written: numbers, ISO 8601 dates, or ISO 8601 times. */
export type PropertyRangeKind = "date" | "datetime" | "number";

/** The inline constraints a property of this type takes. */
export type PropertyConstraintFields = {
  length: boolean;
  pattern: boolean;
  range: PropertyRangeKind | null;
  timezone: boolean;
  unique: boolean;
  unit: boolean;
};

export function constraintFieldsForType(type?: string): PropertyConstraintFields {
  const normalized = normalizePropertyType(type);
  const numeric = NUMERIC_TYPES.includes(normalized);
  const string = STRING_TYPES.includes(normalized);
  return {
    length: string,
    pattern: string,
    range: numeric
      ? "number"
      : normalized === "date"
        ? "date"
        : DATE_TYPES.includes(normalized)
          ? "datetime"
          : null,
    timezone: normalized === "datetime",
    unique: normalized !== "" && !NOT_UNIQUE_TYPES.includes(normalized),
    unit: numeric,
  };
}

/** The value types a property of this type can name: those based on exactly this type. */
export function valueTypesForPropertyType(valueTypes: readonly ValueType[], type?: string) {
  const normalized = normalizePropertyType(type);
  return valueTypes.filter((valueType) => valueType.baseType === normalized);
}

export function valueTypeKind(
  valueType: Pick<ValueType, "enum" | "length" | "pattern" | "range" | "unit">,
): ValueTypeKind | undefined {
  if (valueType.enum?.length) {
    return "enum";
  }
  if (valueType.pattern || valueType.length) {
    return "format";
  }
  if (valueType.range) {
    return "range";
  }
  return valueType.unit ? "unit" : undefined;
}

/** Whether a range bound is written the way a property of this range kind writes it. */
export function rangeBoundFits(kind: PropertyRangeKind, bound: number | string) {
  switch (kind) {
    case "number":
      return typeof bound === "number" && Number.isFinite(bound);
    case "date":
      return typeof bound === "string" && ISO_DATE.test(bound) && !Number.isNaN(Date.parse(bound));
    case "datetime":
      return (
        typeof bound === "string" && ISO_DATE_TIME.test(bound) && !Number.isNaN(Date.parse(bound))
      );
  }
}

function boundOrder(kind: PropertyRangeKind, bound: number | string) {
  return kind === "number" ? Number(bound) : Date.parse(String(bound));
}

/** The lower bound is above the upper one. Bounds that do not fit are left to `rangeBoundFits`. */
export function isRangeReversed(kind: PropertyRangeKind, range?: PropertyValueRange) {
  if (range?.min === undefined || range.max === undefined) {
    return false;
  }
  if (!rangeBoundFits(kind, range.min) || !rangeBoundFits(kind, range.max)) {
    return false;
  }
  return boundOrder(kind, range.min) > boundOrder(kind, range.max);
}

export function isLengthReversed(length?: PropertyLengthRange) {
  return length?.min !== undefined && length.max !== undefined && length.min > length.max;
}

/** An IANA time zone name such as Asia/Shanghai, as the backend accepts it. */
export function isTimezoneName(value: string) {
  if (!value || value === "Local") {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** The time zone names the browser knows, for the time zone input; empty where it lists none. */
export function knownTimezoneNames(): string[] {
  const supportedValuesOf = (Intl as { supportedValuesOf?: (key: string) => string[] })
    .supportedValuesOf;
  try {
    return supportedValuesOf ? supportedValuesOf("timeZone") : [];
  } catch {
    return [];
  }
}

function normalizeBounds<T extends number | string>(
  range?: { max?: T | null; min?: T | null } | null,
): { max?: T; min?: T } | undefined {
  if (!range) {
    return undefined;
  }
  const next: { max?: T; min?: T } = {};
  if (range.min !== undefined && range.min !== null && range.min !== "") {
    next.min = range.min;
  }
  if (range.max !== undefined && range.max !== null && range.max !== "") {
    next.max = range.max;
  }
  return next.min === undefined && next.max === undefined ? undefined : next;
}

const trimmed = (value?: string | null) => value?.trim() || undefined;

/** Drops what declares nothing: empty text, empty bounds, `unique: false`, an empty passthrough. */
export function normalizeConstraints(
  constraints?: PropertyConstraints | null,
): PropertyConstraints | undefined {
  if (!constraints) {
    return undefined;
  }
  const next: PropertyConstraints = {};
  const valueType = trimmed(constraints.valueType);
  const range = normalizeBounds(constraints.range);
  const length = normalizeBounds(constraints.length);
  const unit = trimmed(constraints.unit);
  const timezone = trimmed(constraints.timezone);

  if (valueType) next.valueType = valueType;
  if (range) next.range = range;
  if (length) next.length = length;
  if (constraints.pattern) next.pattern = constraints.pattern;
  if (unit) next.unit = unit;
  if (constraints.unique) next.unique = true;
  if (constraints.crs) next.crs = constraints.crs;
  if (timezone) next.timezone = timezone;
  if (constraints.passthrough && Object.keys(constraints.passthrough).length) {
    next.passthrough = { ...constraints.passthrough };
  }

  return Object.keys(next).length ? next : undefined;
}

/** Drops what declares nothing, so an undeclared property has no `declarations` at all. */
export function normalizeDeclarations(
  declarations?: PropertyDeclarations | null,
): PropertyDeclarations | undefined {
  if (!declarations) {
    return undefined;
  }
  const next: PropertyDeclarations = {};
  const aliases = (declarations.aliases ?? []).map((alias) => alias.trim()).filter(Boolean);
  const constraints = normalizeConstraints(declarations.constraints);

  if (declarations.semantic) next.semantic = declarations.semantic;
  if (declarations.required) next.required = true;
  if (aliases.length) next.aliases = aliases;
  if (constraints) next.constraints = constraints;

  return Object.keys(next).length ? next : undefined;
}

export const hasDeclarations = (declarations?: PropertyDeclarations | null) =>
  normalizeDeclarations(declarations) !== undefined;

/** JSON with object keys sorted, so two values compare equal whatever order their keys came in. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

/** Deep equality of two declarations, or two parts of them, after dropping what declares nothing. */
export function areDeclarationValuesEqual(left: unknown, right: unknown) {
  return stableStringify(left) === stableStringify(right);
}

export function arePropertyDeclarationsEqual(
  left?: PropertyDeclarations | null,
  right?: PropertyDeclarations | null,
) {
  return areDeclarationValuesEqual(normalizeDeclarations(left), normalizeDeclarations(right));
}

/** The declarations a type change cleared, as the section names them. */
export type ClearedDeclarationName =
  | "crs"
  | "length"
  | "pattern"
  | "range"
  | "semantic"
  | "timezone"
  | "unique"
  | "unit"
  | "valueType";

/**
 * Clears the declarations a property of `type` cannot make: a Semantic of another type, a value
 * type based on another type, and the constraints the type does not take. A value type missing
 * from `valueTypes` (the list did not load) is kept; the backend still checks it.
 */
export function fitDeclarationsToType(
  declarations: PropertyDeclarations | undefined,
  type: string | undefined,
  valueTypes: readonly ValueType[],
): { cleared: ClearedDeclarationName[]; declarations: PropertyDeclarations | undefined } {
  const current = normalizeDeclarations(declarations);
  if (!current) {
    return { cleared: [], declarations: undefined };
  }

  const cleared: ClearedDeclarationName[] = [];
  const next: PropertyDeclarations = { ...current };
  if (next.semantic && !semanticsForType(type).includes(next.semantic)) {
    delete next.semantic;
    cleared.push("semantic");
  }

  if (next.constraints) {
    const constraints: PropertyConstraints = { ...next.constraints };
    const fields = constraintFieldsForType(type);
    const clear = (name: ClearedDeclarationName & keyof PropertyConstraints) => {
      delete constraints[name];
      cleared.push(name);
    };
    const referenced = constraints.valueType
      ? valueTypes.find((valueType) => valueType.id === constraints.valueType)
      : undefined;

    if (referenced && referenced.baseType !== normalizePropertyType(type)) clear("valueType");
    if (
      constraints.range &&
      (!fields.range ||
        [constraints.range.min, constraints.range.max].some(
          (bound) => bound !== undefined && !rangeBoundFits(fields.range!, bound),
        ))
    ) {
      clear("range");
    }
    if (constraints.length && !fields.length) clear("length");
    if (constraints.pattern && !fields.pattern) clear("pattern");
    if (constraints.unit && !fields.unit) clear("unit");
    if (constraints.unique && !fields.unique) clear("unique");
    if (constraints.crs && !crsApplies(next.semantic)) clear("crs");
    if (constraints.timezone && !fields.timezone) clear("timezone");
    next.constraints = constraints;
  }

  return { cleared, declarations: normalizeDeclarations(next) };
}

/** Naming a value type drops the inline rules it now holds: range, length, pattern and unit. */
export function withValueType(
  constraints: PropertyConstraints | undefined,
  valueType: string | undefined,
): PropertyConstraints | undefined {
  if (!valueType) {
    return normalizeConstraints({ ...constraints, valueType: undefined });
  }
  return normalizeConstraints({
    ...constraints,
    length: undefined,
    pattern: undefined,
    range: undefined,
    unit: undefined,
    valueType,
  });
}

/** A problem with one alias, as a locale key under `property.aliasProblem` and its parameters. */
export type AliasProblem = {
  key: "comma" | "duplicate" | "empty" | "otherProperty" | "ownName" | "tooLong" | "tooMany";
  params?: Record<string, number | string>;
};

/**
 * Checks the aliases of one property: their count, each alias, and that none is the name or
 * display name of this property or of another property of the object type.
 */
export function aliasProblem(
  aliases: readonly string[],
  ownNames: readonly string[],
  otherProperties: ReadonlyArray<Pick<ObjectTypeDataProperty, "displayName" | "name">>,
): AliasProblem | null {
  if (aliases.length > MAX_PROPERTY_ALIASES) {
    return { key: "tooMany", params: { max: MAX_PROPERTY_ALIASES } };
  }
  const seen = new Set<string>();
  for (const raw of aliases) {
    const alias = raw.trim();
    if (!alias) {
      return { key: "empty" };
    }
    if (ALIAS_SEPARATORS.some((separator) => alias.includes(separator))) {
      return { key: "comma", params: { alias } };
    }
    if (Array.from(alias).length > MAX_ALIAS_LENGTH) {
      return { key: "tooLong", params: { alias, max: MAX_ALIAS_LENGTH } };
    }
    if (seen.has(alias)) {
      return { key: "duplicate", params: { alias } };
    }
    if (ownNames.includes(alias)) {
      return { key: "ownName", params: { alias } };
    }
    const other = otherProperties.find(
      (property) => property.name === alias || property.displayName === alias,
    );
    if (other) {
      return { key: "otherProperty", params: { alias, property: other.name } };
    }
    seen.add(alias);
  }
  return null;
}

/** A rule across the properties of one object type, as a locale key under `property.issue`. */
export type PropertyDeclarationIssue = {
  key:
    | "aliasTaken"
    | "crsMismatch"
    | "endTimeWithoutEventTime"
    | "latitudeWithoutLongitude"
    | "locationWithCoordinates"
    | "longitudeWithoutLatitude"
    | "semanticTaken";
  params?: Record<string, string>;
  /** The properties the problem involves, the first being the one to fix. */
  properties: string[];
};

/**
 * Checks the declarations of the data properties of one object type against each other: each
 * Semantic once, end_time with event_time, latitude with longitude, location apart from them, the
 * same crs on both coordinates, and no alias that names another property.
 */
export function checkPropertyDeclarations(
  properties: readonly ObjectTypeDataProperty[],
): PropertyDeclarationIssue[] {
  const issues: PropertyDeclarationIssue[] = [];
  const bySemantic = new Map<PropertySemantic, ObjectTypeDataProperty>();

  properties.forEach((property) => {
    const semantic = property.declarations?.semantic;
    if (!semantic) {
      return;
    }
    const holder = bySemantic.get(semantic);
    if (holder) {
      issues.push({
        key: "semanticTaken",
        params: { semantic },
        properties: [property.name, holder.name],
      });
      return;
    }
    bySemantic.set(semantic, property);
  });

  const endTime = bySemantic.get("end_time");
  if (endTime && !bySemantic.has("event_time")) {
    issues.push({ key: "endTimeWithoutEventTime", properties: [endTime.name] });
  }
  const latitude = bySemantic.get("latitude");
  const longitude = bySemantic.get("longitude");
  if (latitude && !longitude) {
    issues.push({ key: "latitudeWithoutLongitude", properties: [latitude.name] });
  }
  if (longitude && !latitude) {
    issues.push({ key: "longitudeWithoutLatitude", properties: [longitude.name] });
  }
  const location = bySemantic.get("location");
  const coordinate = latitude ?? longitude;
  if (location && coordinate) {
    issues.push({
      key: "locationWithCoordinates",
      properties: [location.name, coordinate.name],
    });
  }
  const latitudeCrs = latitude?.declarations?.constraints?.crs;
  const longitudeCrs = longitude?.declarations?.constraints?.crs;
  if (latitude && longitude && latitudeCrs && longitudeCrs && latitudeCrs !== longitudeCrs) {
    issues.push({
      key: "crsMismatch",
      params: { latitude: latitudeCrs, longitude: longitudeCrs },
      properties: [longitude.name, latitude.name],
    });
  }

  properties.forEach((property) => {
    for (const alias of property.declarations?.aliases ?? []) {
      const other = properties.find(
        (item) => item !== property && (item.name === alias || item.displayName === alias),
      );
      if (other) {
        issues.push({
          key: "aliasTaken",
          params: { alias, property: other.name },
          properties: [property.name, other.name],
        });
        return;
      }
    }
  });

  return issues;
}

/** The property that already declares each Semantic value, other than the one being edited. */
export function semanticHolders(
  properties: readonly ObjectTypeDataProperty[],
  editing?: string,
): Map<PropertySemantic, ObjectTypeDataProperty> {
  const holders = new Map<PropertySemantic, ObjectTypeDataProperty>();
  properties.forEach((property) => {
    const semantic = property.declarations?.semantic;
    if (semantic && property.name !== editing && !holders.has(semantic)) {
      holders.set(semantic, property);
    }
  });
  return holders;
}

const INTEGER = /^[+-]?\d+$/;
const UNSIGNED_INTEGER = /^\d+$/;
const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/** Whether an enum code, always written as text, is a value of the base type. */
export function enumValueFits(baseType: string, value: string) {
  switch (normalizePropertyType(baseType)) {
    case "integer":
      return INTEGER.test(value);
    case "unsigned integer":
      return UNSIGNED_INTEGER.test(value);
    case "float":
    case "decimal":
      return DECIMAL.test(value);
    case "date":
      return rangeBoundFits("date", value);
    case "datetime":
    case "timestamp":
      return rangeBoundFits("datetime", value);
    default:
      return true;
  }
}

/** What two enum codes compare by: 1 and 1.0 of a decimal are the same code, as are two spellings of one instant. */
export function enumValueKey(baseType: string, value: string) {
  switch (normalizePropertyType(baseType)) {
    case "integer":
    case "unsigned integer":
    case "float":
    case "decimal":
      return String(Number(value));
    case "date":
    case "datetime":
    case "timestamp":
      return String(Date.parse(value));
    default:
      return value;
  }
}
