/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type ConnectorOptionDefinition = {
  key: string;
  label: string;
  hint?: string;
} & (
  | { kind: "boolean"; acceptsStrings?: boolean }
  | { kind: "enum"; values: readonly string[]; acceptsBoolean?: boolean }
  | { kind: "seconds"; signedString?: boolean }
  | { kind: "duration"; positive?: boolean }
  | { kind: "sessionTimeout" }
  | { kind: "text"; allowEmpty?: boolean; requiresTLS?: boolean }
);

// Verified against Foundry 39023daf and EE eb3266af. Keep these templates aligned
// with normalizeOptions in the connectors; backend validation remains authoritative.
const TIME_ZONE = {
  kind: "text",
  key: "time_zone",
  label: "timeZone",
  hint: "timeZone",
  allowEmpty: true,
} as const;
const MYSQL_OPTIONS: readonly ConnectorOptionDefinition[] = [
  TIME_ZONE,
  { kind: "text", key: "charset", label: "charset", hint: "mysqlCharset" },
  { kind: "text", key: "collation", label: "collation" },
  { kind: "duration", key: "timeout", label: "connectTimeout", hint: "duration" },
  { kind: "duration", key: "readTimeout", label: "readTimeout", hint: "duration" },
  { kind: "duration", key: "writeTimeout", label: "writeTimeout", hint: "duration" },
  {
    kind: "enum",
    key: "tls",
    label: "tls",
    hint: "mysqlTLS",
    values: ["true", "false", "skip-verify", "preferred"],
    acceptsBoolean: true,
  },
];

const OPTION_TEMPLATES: Record<string, readonly ConnectorOptionDefinition[]> = {
  mysql: MYSQL_OPTIONS,
  mariadb: MYSQL_OPTIONS,
  postgresql: [
    { ...TIME_ZONE, key: "timezone" },
    {
      kind: "enum",
      key: "sslmode",
      label: "sslMode",
      hint: "sslMode",
      values: ["", "disable", "allow", "prefer", "require", "verify-ca", "verify-full"],
    },
    { kind: "seconds", key: "connect_timeout", label: "connectTimeout", signedString: true },
    { kind: "text", key: "application_name", label: "applicationName", allowEmpty: true },
    {
      kind: "text",
      key: "fallback_application_name",
      label: "fallbackApplicationName",
      allowEmpty: true,
    },
    {
      kind: "sessionTimeout",
      key: "statement_timeout",
      label: "statementTimeout",
      hint: "sessionTimeout",
    },
    { kind: "sessionTimeout", key: "lock_timeout", label: "lockTimeout", hint: "sessionTimeout" },
    {
      kind: "sessionTimeout",
      key: "idle_in_transaction_session_timeout",
      label: "idleTransactionTimeout",
      hint: "sessionTimeout",
    },
  ],
  sqlserver: [
    { kind: "boolean", key: "encrypt", label: "encrypt" },
    {
      kind: "boolean",
      key: "trustservercertificate",
      label: "trustCertificate",
      hint: "trustCertificate",
    },
    { kind: "text", key: "hostnameincertificate", label: "certificateName", allowEmpty: true },
    { kind: "seconds", key: "connection timeout", label: "connectTimeout" },
    { kind: "text", key: "app name", label: "applicationName", allowEmpty: true },
    { kind: "enum", key: "tlsmin", label: "tlsMinimum", values: ["1.0", "1.1", "1.2", "1.3"] },
  ],
  oracle: [
    { kind: "boolean", key: "ssl", label: "tls" },
    { kind: "boolean", key: "ssl verify", label: "verifyCertificate" },
    { kind: "seconds", key: "timeout", label: "timeout" },
    { kind: "seconds", key: "connect timeout", label: "connectTimeout" },
    { kind: "seconds", key: "connection timeout", label: "connectionTimeout" },
    { kind: "seconds", key: "read timeout", label: "readTimeout" },
    { kind: "seconds", key: "socket timeout", label: "socketTimeout" },
    { kind: "text", key: "server", label: "server" },
    { kind: "text", key: "charset", label: "charset", hint: "oracleCharset" },
  ],
  hana: [
    { kind: "boolean", key: "tls", label: "tls", acceptsStrings: true },
    {
      kind: "text",
      key: "TLSServerName",
      label: "certificateName",
      hint: "hanaCertificate",
      requiresTLS: true,
    },
    { kind: "seconds", key: "timeout", label: "timeout", signedString: true },
  ],
  doris: [
    TIME_ZONE,
    {
      kind: "duration",
      key: "timeout",
      label: "connectTimeout",
      hint: "positiveDuration",
      positive: true,
    },
    {
      kind: "duration",
      key: "readTimeout",
      label: "readTimeout",
      hint: "positiveDuration",
      positive: true,
    },
    {
      kind: "duration",
      key: "writeTimeout",
      label: "writeTimeout",
      hint: "positiveDuration",
      positive: true,
    },
    { kind: "boolean", key: "tls", label: "tls" },
  ],
};

export function getConnectorOptionDefinitions(connectorType?: string) {
  const type = connectorType?.trim().toLowerCase() ?? "";
  return Object.hasOwn(OPTION_TEMPLATES, type) ? OPTION_TEMPLATES[type] : undefined;
}

export function normalizeConnectorOptionKey(connectorType: string | undefined, key: string) {
  const type = connectorType?.trim().toLowerCase();
  return type === "sqlserver" || type === "oracle" ? key.trim().toLowerCase() : key.trim();
}

export function readConnectorOptions(value: unknown): Record<string, unknown> | null {
  if (value === undefined || value === null || value === "") return {};
  if (typeof value === "string") {
    if (!value.trim()) return {};
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export type ConnectorOptionError =
  | "json"
  | "duplicate"
  | "boolean"
  | "enum"
  | "seconds"
  | "duration"
  | "positiveDuration"
  | "sessionTimeout"
  | "text"
  | "nonEmptyText"
  | "requiresTLS";

export function validateConnectorOption(
  definition: ConnectorOptionDefinition,
  value: unknown,
  options: Record<string, unknown>,
): ConnectorOptionError | undefined {
  switch (definition.kind) {
    case "boolean":
      return typeof value === "boolean" ||
        (definition.acceptsStrings &&
          typeof value === "string" &&
          /^(true|false)$/i.test(value.trim()))
        ? undefined
        : "boolean";
    case "enum":
      return (typeof value === "string" && definition.values.includes(value.trim())) ||
        (definition.acceptsBoolean && typeof value === "boolean")
        ? undefined
        : "enum";
    case "seconds": {
      const integer =
        typeof value === "number"
          ? value
          : typeof value === "string" &&
              (definition.signedString ? /^[+-]?\d+$/ : /^\d+$/).test(value.trim())
            ? Number(value)
            : NaN;
      return Number.isInteger(integer) && integer >= 0 && integer <= 9223372036
        ? undefined
        : "seconds";
    }
    case "duration": {
      const nanos = typeof value === "string" ? durationNanoseconds(value.trim()) : null;
      return nanos !== null && (definition.positive ? nanos > 0n : nanos >= 0n)
        ? undefined
        : definition.positive
          ? "positiveDuration"
          : "duration";
    }
    case "sessionTimeout": {
      if (typeof value === "number") {
        return Number.isFinite(value) && value >= 0 && value <= 2147483647
          ? undefined
          : "sessionTimeout";
      }
      const match =
        typeof value === "string"
          ? /^\+?(\d+(?:\.\d*)?|\.\d+)\s*(us|ms|s|min|h|d)?$/.exec(value.trim())
          : null;
      if (!match || !Number.isFinite(Number(match[1]))) return "sessionTimeout";
      return (!match[2] || match[2] === "ms") && Number(match[1]) > 2147483647
        ? "sessionTimeout"
        : undefined;
    }
    case "text": {
      if (typeof value !== "string") return "text";
      if (!definition.allowEmpty && !value.trim()) return "nonEmptyText";
      const tls = Object.entries(options).find(([key]) => key.trim() === "tls")?.[1];
      if (
        definition.requiresTLS &&
        tls !== true &&
        !(typeof tls === "string" && tls.trim().toLowerCase() === "true")
      )
        return "requiresTLS";
      return undefined;
    }
  }
}

export function validateConnectorOptions(
  connectorType: string | undefined,
  value: unknown,
): { error: ConnectorOptionError; key?: string } | undefined {
  const options = readConnectorOptions(value);
  if (!options) return { error: "json" };
  const seen = new Set<string>();
  const definitions = getConnectorOptionDefinitions(connectorType);
  for (const [key, entry] of Object.entries(options)) {
    const normalized = normalizeConnectorOptionKey(connectorType, key);
    if (seen.has(normalized)) return { error: "duplicate", key };
    seen.add(normalized);
    const definition = definitions?.find((option) => option.key === normalized);
    if (definition) {
      const error = validateConnectorOption(definition, entry, options);
      if (error) return { error, key };
    }
  }
  return undefined;
}

function durationNanoseconds(text: string): bigint | null {
  if (/^[+-]?0$/.test(text)) return 0n;
  if (!/^[+-]?(?:(?:\d+(?:\.\d*)?|\.\d+)(?:ns|us|µs|μs|ms|s|m|h))+$/.test(text)) return null;
  const units: Record<string, bigint> = {
    ns: 1n,
    us: 1000n,
    µs: 1000n,
    μs: 1000n,
    ms: 1000000n,
    s: 1000000000n,
    m: 60000000000n,
    h: 3600000000000n,
  };
  let total = 0n;
  for (const match of text.matchAll(/(\d+(?:\.\d*)?|\.\d+)(ns|us|µs|μs|ms|s|m|h)/g)) {
    const [whole, fraction = ""] = match[1].split(".");
    total += BigInt(whole || "0") * units[match[2]];
    if (fraction) total += (BigInt(fraction) * units[match[2]]) / 10n ** BigInt(fraction.length);
    if (total > 9223372036854775807n) return null;
  }
  return text.startsWith("-") ? -total : total;
}
