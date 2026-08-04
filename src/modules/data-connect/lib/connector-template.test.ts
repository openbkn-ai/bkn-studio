/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  getConnectorConfigDefaults,
  getConnectorFieldPlaceholder,
  getConnectorTemplateMeta,
  groupConnectorFields,
  isValidJSONObject,
  resolveConnectorFieldControl,
} from "@/modules/data-connect/lib/connector-template";
import type { DataConnectConnectorType } from "@/modules/data-connect/types/data-connect";

const sqlServerConnector: DataConnectConnectorType = {
  category: "table",
  description: "Microsoft SQL Server 关系型数据库连接器",
  enabled: true,
  fieldConfig: {
    host: field("主机地址", "string", true),
    port: field("端口号", "integer", true),
    username: field("用户名", "string", true),
    password: field("密码", "string", true, true),
    database: field("数据库名", "string", true),
    schemas: field("Schema 列表", "array", false),
    options: field("连接参数", "object", false),
  },
  mode: "local",
  name: "sqlserver",
  type: "sqlserver",
};

describe("connector-template · SQL Server", () => {
  it("provides SQL Server defaults and field guidance", () => {
    expect(getConnectorConfigDefaults(sqlServerConnector)).toEqual({ port: 1433 });
    expect(getConnectorFieldPlaceholder("port", "integer", "sqlserver")).toBe(
      "例如 1433",
    );
    expect(getConnectorFieldPlaceholder("options", "object", "sqlserver")).toBe(
      '例如 {"encrypt":true,"trustservercertificate":false}',
    );
    expect(getConnectorTemplateMeta(sqlServerConnector).description).toBe(
      "连接 Microsoft SQL Server 业务数据库。",
    );
  });

  it("uses tags for schemas and JSON for driver options", () => {
    expect(resolveConnectorFieldControl("schemas", "array")).toEqual({ kind: "tags" });
    expect(resolveConnectorFieldControl("options", "object")).toEqual({ kind: "json" });

    const advancedFields = groupConnectorFields(sqlServerConnector).find(
      (group) => group.key === "advanced",
    );
    expect(advancedFields?.fields.map(([name]) => name)).toEqual(["options", "schemas"]);
  });

  it("accepts only JSON objects for object connector fields", () => {
    expect(isValidJSONObject(undefined)).toBe(true);
    expect(isValidJSONObject("")).toBe(true);
    expect(isValidJSONObject("   ")).toBe(true);
    expect(isValidJSONObject("null")).toBe(false);
    expect(isValidJSONObject("  null  ")).toBe(false);
    expect(isValidJSONObject('{"encrypt":true}')).toBe(true);
    expect(isValidJSONObject({ encrypt: true })).toBe(true);
    expect(isValidJSONObject("[]")).toBe(false);
    expect(isValidJSONObject("true")).toBe(false);
    expect(isValidJSONObject("{invalid")).toBe(false);
  });
});

function field(name: string, type: string, required: boolean, encrypted = false) {
  return {
    description: "",
    encrypted,
    name,
    required,
    type,
  };
}
