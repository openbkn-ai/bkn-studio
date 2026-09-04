/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it } from "vitest";

import i18n from "@/app/locales/i18n";
import {
  isCertifiedConnectorType,
  filterConnectorTypes,
  getConnectorConfigDefaults,
  getDataSourceFamilyMeta,
  getConnectorFieldHint,
  getConnectorFieldPlaceholder,
  getConnectorTemplateMeta,
  getConnectorTypeTags,
  groupConnectorFields,
  humanizeConnectorFieldLabel,
  isConnectorFieldRequired,
  isConnectorFieldVisible,
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
  beforeEach(async () => {
    await i18n.changeLanguage("zh-CN");
  });

  it("provides SQL Server defaults and field guidance", () => {
    expect(getConnectorConfigDefaults(sqlServerConnector)).toEqual({ port: 1433 });
    expect(getConnectorFieldPlaceholder("port", "integer", "sqlserver")).toBe(
      "例如 1433",
    );
    expect(getConnectorFieldPlaceholder("options", "object", "sqlserver")).toBe(
      '例如 {"encrypt":true,"trustservercertificate":false}',
    );
    expect(getConnectorFieldPlaceholder("schemas", "array", "sqlserver")).toBe(
      "留空扫描全部可访问 Schema；输入名称后按回车逐个添加",
    );
    expect(getConnectorFieldPlaceholder("databases", "array", "mariadb")).toBe(
      "留空自动发现全部数据库；输入名称后按回车逐个添加",
    );
    expect(getConnectorFieldHint("schemas", "sqlserver")).toBe(
      "填写时必须与数据库中的实际名称及大小写完全一致",
    );
    expect(getConnectorFieldHint("databases", "mariadb")).toBe(
      "填写时必须与数据库中的实际名称及大小写完全一致",
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

  it("resolves template copy from the active English locale", async () => {
    await i18n.changeLanguage("en-US");

    expect(getDataSourceFamilyMeta("structured")).toMatchObject({
      label: "Structured and semi-structured data",
    });
    expect(getConnectorTemplateMeta(sqlServerConnector).description).toBe(
      "Connect Microsoft SQL Server relational databases.",
    );
    expect(getConnectorFieldPlaceholder("port", "integer", "sqlserver")).toBe(
      "For example: 1433",
    );
    expect(getConnectorFieldPlaceholder("schemas", "array", "sqlserver")).toBe(
      "Leave empty to discover all accessible schemas, or enter each name and press Enter",
    );
    expect(getConnectorFieldPlaceholder("databases", "array", "mariadb")).toBe(
      "Leave empty to discover all databases, or enter each name and press Enter",
    );
    expect(getConnectorFieldHint("schemas", "sqlserver")).toBe(
      "When specified, schema names must exactly match the database, including case",
    );
    expect(getConnectorFieldHint("databases", "mariadb")).toBe(
      "When specified, database names must exactly match the database, including case",
    );
    expect(humanizeConnectorFieldLabel("host")).toBe("Host");
    expect(humanizeConnectorFieldLabel("cluster")).toBe("Cluster");
    expect(resolveConnectorFieldControl("ssl_mode", "string")).toEqual({
      kind: "select",
      options: [
        { label: "Disable", value: "disable" },
        { label: "Prefer", value: "prefer" },
        { label: "Require", value: "require" },
        { label: "Verify CA", value: "verify-ca" },
        { label: "Verify full", value: "verify-full" },
      ],
    });
  });

  it("uses frontend locale resources for field labels", () => {
    expect(humanizeConnectorFieldLabel("host")).toBe("主机地址");
    expect(humanizeConnectorFieldLabel("cluster")).toBe("集群");
    expect(humanizeConnectorFieldLabel("custom_setting")).toBe("Custom setting");
  });

  it("localizes every built-in connector field without backend display text", async () => {
    const zhLabels = {
      app_id: "应用 ID",
      app_secret: "应用密钥",
      auth_type: "认证方式",
      database: "数据库",
      databases: "数据库列表",
      doc_lib_type: "文档库类型",
      host: "主机地址",
      index_pattern: "索引模式",
      options: "连接参数",
      password: "密码",
      paths: "路径列表",
      port: "端口号",
      protocol: "协议",
      schemas: "Schema 列表",
      token: "访问令牌",
      username: "用户名",
    };
    const enLabels: Record<string, string> = {
      app_id: "Application ID",
      app_secret: "Application secret",
      auth_type: "Authentication type",
      database: "Database",
      databases: "Database list",
      doc_lib_type: "Document library type",
      host: "Host",
      index_pattern: "Index pattern",
      options: "Connection options",
      password: "Password",
      paths: "Paths",
      port: "Port",
      protocol: "Protocol",
      schemas: "Schema list",
      token: "Access token",
      username: "Username",
    };
    const builtInConnectorFieldKeys = {
      mariadb: ["host", "port", "username", "password", "databases", "options"],
      mysql: ["host", "port", "username", "password", "databases", "options"],
      postgresql: ["host", "port", "username", "password", "database", "schemas", "options"],
      sqlserver: ["host", "port", "username", "password", "database", "schemas", "options"],
      opensearch: ["host", "port", "username", "password", "index_pattern"],
      anyshare: ["protocol", "host", "port", "auth_type", "token", "app_id", "app_secret", "doc_lib_type", "paths"],
    } as const;

    for (const [connectorType, fields] of Object.entries(builtInConnectorFieldKeys)) {
      for (const fieldName of fields) {
        expect(humanizeConnectorFieldLabel(fieldName, connectorType)).toBe(
          zhLabels[fieldName],
        );
      }
    }

    await i18n.changeLanguage("en-US");
    for (const [connectorType, fields] of Object.entries(builtInConnectorFieldKeys)) {
      for (const fieldName of fields) {
        expect(humanizeConnectorFieldLabel(fieldName, connectorType)).toBe(
          enLabels[fieldName],
        );
      }
    }
  });

  it("uses the AnyShare template for enum controls and conditional credentials", () => {
    expect(resolveConnectorFieldControl("protocol", "string", "anyshare")).toEqual({
      kind: "select",
      options: [
        { label: "HTTP", value: "http" },
        { label: "HTTPS", value: "https" },
      ],
    });
    expect(resolveConnectorFieldControl("auth_type", "integer", "anyshare")).toEqual({
      kind: "select",
      options: [
        { label: "访问令牌", value: 1 },
        { label: "应用凭据", value: 2 },
      ],
    });
    expect(isConnectorFieldVisible("anyshare", "token", { auth_type: 1 })).toBe(true);
    expect(isConnectorFieldVisible("anyshare", "token", { auth_type: 2 })).toBe(false);
    expect(isConnectorFieldRequired("anyshare", "token", false, { auth_type: 1 })).toBe(true);
    expect(isConnectorFieldRequired("anyshare", "app_secret", false, { auth_type: 1 })).toBe(
      false,
    );
    expect(isConnectorFieldRequired("anyshare", "app_secret", false, { auth_type: 2 })).toBe(
      true,
    );
  });
});

function field(_name: string, type: string, required: boolean, encrypted = false) {
  return {
    encrypted,
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
