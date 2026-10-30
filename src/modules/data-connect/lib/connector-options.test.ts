/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  getConnectorOptionDefinitions,
  readConnectorOptions,
  validateConnectorOptions,
} from "./connector-options";
import { resolveConnectorFieldControl } from "./connector-template";

describe("connector option templates", () => {
  it.each(["mysql", "mariadb", "postgresql", "sqlserver", "oracle", "hana", "doris"])(
    "uses structured controls for %s",
    (type) => {
      expect(getConnectorOptionDefinitions(type)?.length).toBeGreaterThan(0);
      expect(resolveConnectorFieldControl("options", "object", type)).toEqual({ kind: "options" });
    },
  );

  it("retains the JSON editor for connectors without option definitions", () => {
    expect(getConnectorOptionDefinitions("custom")).toBeUndefined();
    expect(getConnectorOptionDefinitions("constructor")).toBeUndefined();
    expect(resolveConnectorFieldControl("options", "object", "custom")).toEqual({ kind: "json" });
    expect(resolveConnectorFieldControl("other", "object", "mysql")).toEqual({ kind: "json" });
  });

  it("matches canonical keys and driver-required casing", () => {
    expect(getConnectorOptionDefinitions("sqlserver")?.map((option) => option.key)).toEqual([
      "encrypt",
      "trustservercertificate",
      "hostnameincertificate",
      "connection timeout",
      "app name",
      "tlsmin",
    ]);
    expect(getConnectorOptionDefinitions("hana")?.map((option) => option.key)).toEqual([
      "tls",
      "TLSServerName",
      "timeout",
    ]);
    expect(getConnectorOptionDefinitions("oracle")?.map((option) => option.key)).toEqual([
      "ssl",
      "ssl verify",
      "timeout",
      "connect timeout",
      "connection timeout",
      "read timeout",
      "socket timeout",
      "server",
      "charset",
    ]);
    expect(getConnectorOptionDefinitions("mysql")).toBe(getConnectorOptionDefinitions("mariadb"));
  });
});

describe("validateConnectorOptions", () => {
  it.each([undefined, null, "", "   ", {}, "{}"])(
    "accepts omitted or empty options: %j",
    (value) => {
      expect(validateConnectorOptions("mysql", value)).toBeUndefined();
    },
  );

  it.each(["null", "[]", "{invalid", [], 1, true])(
    "rejects invalid option objects: %j",
    (value) => {
      expect(validateConnectorOptions("mysql", value)).toEqual({ error: "json" });
    },
  );

  it("preserves types, explicit empty values and unknown entries without mutating them", () => {
    const options = {
      encrypt: false,
      "connection timeout": "0",
      future: { nested: [1, false, ""] },
    };
    const snapshot = JSON.stringify(options);
    expect(readConnectorOptions(options)).toBe(options);
    expect(readConnectorOptions(snapshot)).toEqual(options);
    expect(validateConnectorOptions("sqlserver", options)).toBeUndefined();
    expect(JSON.stringify(options)).toBe(snapshot);
  });

  it.each(["mysql", "mariadb", "doris", "postgresql"])(
    "preserves %s native time zone strings including empty and offset signs",
    (type) => {
      const key = type === "postgresql" ? "timezone" : "time_zone";
      for (const value of [
        "",
        "   ",
        "+08:00",
        "-08:00",
        "Asia/Shanghai",
        "database-native-value",
      ]) {
        const options = { [key]: value };
        expect(validateConnectorOptions(type, options)).toBeUndefined();
        expect(options[key]).toBe(value);
      }
      expect(validateConnectorOptions(type, { [key]: false })).toEqual({ key, error: "text" });
    },
  );

  it.each([
    ["sqlserver", { encrypt: "true" }, "boolean"],
    ["oracle", { ssl: "false" }, "boolean"],
    ["doris", { tls: "true" }, "boolean"],
    ["sqlserver", { tlsmin: "1.4" }, "enum"],
    ["postgresql", { sslmode: "unsupported" }, "enum"],
    ["mysql", { tls: "custom-profile" }, "enum"],
    ["oracle", { charset: " " }, "nonEmptyText"],
    ["hana", { TLSServerName: "db.example" }, "requiresTLS"],
    ["hana", { tls: false, TLSServerName: "db.example" }, "requiresTLS"],
  ] as const)("rejects invalid %s values: %j", (type, options, error) => {
    expect(validateConnectorOptions(type, options)?.error).toBe(error);
  });

  it("accepts legacy TLS representations, enum defaults and normalized names", () => {
    for (const tls of [true, false, "true", "false", "preferred", "skip-verify"]) {
      expect(validateConnectorOptions("mysql", { tls })).toBeUndefined();
    }
    expect(validateConnectorOptions("postgresql", { sslmode: "" })).toBeUndefined();
    expect(
      validateConnectorOptions("hana", { " tls ": " TRUE ", TLSServerName: "db.example" }),
    ).toBeUndefined();
    expect(validateConnectorOptions("sqlserver", { " Encrypt ": false })).toBeUndefined();
    expect(validateConnectorOptions("oracle", { " SSL VERIFY ": true })).toBeUndefined();
    expect(validateConnectorOptions("sqlserver", { Encrypt: false, encrypt: true })).toEqual({
      key: "encrypt",
      error: "duplicate",
    });
    expect(validateConnectorOptions("mysql", { timeout: "1s", " timeout ": "2s" })?.error).toBe(
      "duplicate",
    );
  });

  it.each(["sqlserver", "oracle", "hana", "postgresql"])(
    "checks %s integer timeout bounds while retaining string representations",
    (type) => {
      const key =
        type === "sqlserver"
          ? "connection timeout"
          : type === "postgresql"
            ? "connect_timeout"
            : "timeout";
      for (const timeout of [0, 1, 9223372036, "0", " 30 "]) {
        expect(validateConnectorOptions(type, { [key]: timeout })).toBeUndefined();
      }
      for (const timeout of [-1, 0.5, 9223372037, "", "30s", "1.5", null]) {
        expect(validateConnectorOptions(type, { [key]: timeout })?.error).toBe("seconds");
      }
    },
  );

  it("validates MySQL and Doris durations without losing units or precision", () => {
    for (const timeout of [
      "0",
      "0s",
      "-0",
      "500ms",
      "1h30m",
      ".5s",
      "1µs",
      "9223372036854775807ns",
    ]) {
      expect(validateConnectorOptions("mysql", { timeout })).toBeUndefined();
    }
    for (const timeout of ["", "-1s", "30", "1d", "1e3s", "9223372036854775808ns", 30]) {
      expect(validateConnectorOptions("mysql", { timeout })?.error).toBe("duration");
    }
    for (const timeout of ["0", "0s", "0.5ns"]) {
      expect(validateConnectorOptions("doris", { timeout })?.error).toBe("positiveDuration");
    }
    expect(
      validateConnectorOptions("doris", { timeout: "10s", readTimeout: "500ms" }),
    ).toBeUndefined();
  });

  it("distinguishes PostgreSQL session milliseconds from unit-qualified durations", () => {
    for (const statement_timeout of [0, 1.5, "0", "+1.5 ms", "2min", "2147483648s", 2147483647]) {
      expect(validateConnectorOptions("postgresql", { statement_timeout })).toBeUndefined();
    }
    for (const statement_timeout of [-1, "-1s", "1m", "2147483648ms", 2147483648, "", false]) {
      expect(validateConnectorOptions("postgresql", { statement_timeout })?.error).toBe(
        "sessionTimeout",
      );
    }
  });
});
