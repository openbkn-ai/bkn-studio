/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  isCertifiedConnectorType,
  filterConnectorTypes,
  getConnectorConfigDefaults,
  getConnectorFieldPlaceholder,
  getConnectorTemplateMeta,
  getConnectorTypeTags,
  groupConnectorFields,
  isValidJSONObject,
  mergeKnownConnectorTypes,
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
      "连接 Microsoft SQL Server 关系型数据库。",
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

  it("keeps unavailable known connector types alongside backend types", () => {
    const oracleConnector: DataConnectConnectorType = {
      category: "table",
      description: "Oracle connector",
      enabled: true,
      fieldConfig: {},
      mode: "local",
      name: "Oracle",
      type: "oracle",
    };

    const options = mergeKnownConnectorTypes([sqlServerConnector, oracleConnector]);
    const optionsByType = new Map(options.map((item) => [item.type, item]));

    expect(optionsByType.get("sqlserver")).toBe(sqlServerConnector);
    expect(optionsByType.get("postgresql")?.enabled).toBe(false);
    expect(optionsByType.get("postgresql")?.fieldConfig).toEqual({});
    expect(optionsByType.get("oracle")).toBe(oracleConnector);
  });

  it("filters connector types separately by name and tag", () => {
    const openSearchConnector: DataConnectConnectorType = {
      category: "index",
      description: "OpenSearch connector",
      enabled: true,
      fieldConfig: {},
      mode: "local",
      name: "OpenSearch",
      type: "opensearch",
    };

    expect(
      filterConnectorTypes([sqlServerConnector, openSearchConnector], "structured", "关系型数据库"),
    ).toEqual([]);
    expect(
      filterConnectorTypes([sqlServerConnector, openSearchConnector], "structured", " Search "),
    ).toEqual([openSearchConnector]);
    expect(
      filterConnectorTypes(
        [sqlServerConnector, openSearchConnector],
        "structured",
        "",
        "搜索引擎",
      ),
    ).toEqual([openSearchConnector]);

    const anyShareConnector: DataConnectConnectorType = {
      category: "fileset",
      description: "AnyShare connector",
      enabled: true,
      fieldConfig: {},
      mode: "local",
      name: "AnyShare",
      type: "anyshare",
    };

    expect(
      getConnectorTypeTags(
        [sqlServerConnector, openSearchConnector, anyShareConnector],
        "structured",
      ),
    ).toEqual(["关系型数据库", "搜索引擎"]);
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

describe("isCertifiedConnectorType", () => {
  // connector_certified（登记表专业档）覆盖的是商业数据库；权威清单在 Vega 侧，
  // 这里只是展示快照，漏一条只是少个徽标，不会放行任何东西。
  it("SQL Server 属于认证连接器", () => {
    expect(isCertifiedConnectorType("sqlserver")).toBe(true);
    expect(isCertifiedConnectorType(" SQLServer ".toLowerCase().trim())).toBe(true);
  });

  it("社区基础连接器不打标", () => {
    expect(isCertifiedConnectorType("mysql")).toBe(false);
    expect(isCertifiedConnectorType("postgresql")).toBe(false);
  });
});
