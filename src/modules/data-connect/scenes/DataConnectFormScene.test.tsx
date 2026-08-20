/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { DataConnectFormScene } from "@/modules/data-connect/scenes/DataConnectFormScene";

vi.setConfig({ testTimeout: 20_000 });

const permissionState = vi.hoisted(() => ({
  values: new Set<string>(),
}));
type ModalConfirmOptions = {
  onOk?: () => void;
};
/** 集群档位。默认没有快照——社区部署,也是卖点该出现的那一侧。 */
const entitlementState = vi.hoisted(() => ({
  loading: false,
  snapshot: null as { capabilities: string[]; edition: string; extensions: string[] } | null,
}));
const createDataConnectRecordMock = vi.hoisted(() => vi.fn());
const getDataConnectConnectorTypeMock = vi.hoisted(() => vi.fn());
const getDataConnectRecordMock = vi.hoisted(() => vi.fn());
const listDataConnectConnectorTypesMock = vi.hoisted(() => vi.fn());
const testDataConnectConfigMock = vi.hoisted(() => vi.fn());
const updateDataConnectRecordMock = vi.hoisted(() => vi.fn());
const messageErrorMock = vi.hoisted(() => vi.fn());
const messageSuccessMock = vi.hoisted(() => vi.fn());
const modalConfirmMock = vi.hoisted(() => vi.fn<(options: ModalConfirmOptions) => void>());

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: {
      error: messageErrorMock,
      success: messageSuccessMock,
      warning: vi.fn(),
    },
    modal: {
      confirm: modalConfirmMock,
    },
  }),
}));

vi.mock("@/framework/entitlement/use-entitlement", () => ({
  useEntitlementContext: () => entitlementState,
}));

vi.mock("@/framework/permission/PermissionGate", () => ({
  PermissionGate: ({
    children,
    fallback = null,
    permissions,
  }: {
    children: ReactNode;
    fallback?: ReactNode;
    permissions: string | string[];
  }) => {
    const required = Array.isArray(permissions) ? permissions : [permissions];
    return required.every((permission) => permissionState.values.has(permission))
      ? children
      : fallback;
  },
}));

vi.mock("react-i18next", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-i18next")>();
  return {
    ...original,
    useTranslation: () => ({
      t: (key: string) => key,
    }),
  };
});

vi.mock("react-router-dom", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...original,
    useNavigate: () => vi.fn(),
  };
});

vi.mock("@/modules/data-connect/services/data-connect.service", () => ({
  createDataConnectRecord: createDataConnectRecordMock,
  getDataConnectConnectorType: getDataConnectConnectorTypeMock,
  getDataConnectRecord: getDataConnectRecordMock,
  isDataConnectConnectionTestFailure: vi.fn(() => false),
  listDataConnectConnectorTypes: listDataConnectConnectorTypesMock,
  testDataConnectConfig: testDataConnectConfigMock,
  updateDataConnectRecord: updateDataConnectRecordMock,
}));

/**
 * 走完整卡片选择 + 连接器表单的两条用例,本机就要 3s 出头,占掉默认 10s 超时的三分之一。
 * CI 的 runner 慢上数倍,那点余量不够——已经因此红过一次。这两条是真的重,不是卡住了。
 */
const HEAVY_SCENE_TIMEOUT_MS = 30_000;

/*
  `findBy*` 默认只等 1s。这一整页是真场景渲染 + antd 的异步表单校验,CI 的 runner 慢上
  数倍,断言会在提示渲染出来之前就放弃——已经因此红过一次(「rejects invalid JSON
  options」找不到 dataConnect.jsonObjectInvalid)。放宽只影响失败路径要多等多久。
*/
configure({ asyncUtilTimeout: 5_000 });

/**
 * 按名字取连接器卡片。
 *
 * 走 `findByText` 再上溯到按钮,而不是 `findByRole("button", { name })`:后者要对整片
 * 卡片逐个算 accessible name,而且每轮轮询重算一次——本机单条查询就要 3s,CI 的机器慢
 * 上数倍,直接把用例顶穿 10s 超时。
 */
async function findConnectorCard(name: string) {
  const label = await screen.findByText(name);
  const card = label.closest("button");

  if (!card) {
    throw new Error(`connector card not found: ${name}`);
  }

  return card;
}

describe("DataConnectFormScene · connection preflight", () => {
  beforeAll(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    }));
  });

  beforeEach(() => {
    vi.useRealTimers();
    permissionState.values = new Set(["catalog:modify"]);
    entitlementState.snapshot = null;
    messageErrorMock.mockReset();
    messageSuccessMock.mockReset();
    modalConfirmMock.mockReset();
    createDataConnectRecordMock.mockReset();
    createDataConnectRecordMock.mockResolvedValue(undefined);
    getDataConnectConnectorTypeMock.mockReset();
    getDataConnectConnectorTypeMock.mockImplementation((type: string) => {
      if (type === "sqlserver") {
        return {
          category: "table",
          description: "",
          enabled: true,
          fieldConfig: {
            api_token: connectorField("API Token", "string", false, true),
            application_name: connectorField("应用名称", "string", false),
            database: connectorField("数据库名", "string", true),
            host: connectorField("主机地址", "string", true),
            options: connectorField("连接参数", "object", false),
            password: connectorField("密码", "string", true, true),
            port: connectorField("端口号", "integer", true),
            schemas: connectorField("Schema 列表", "array", false),
            session_settings: connectorField("会话设置", "object", false),
            username: connectorField("用户名", "string", true),
          },
          mode: "local",
          name: "SQL Server",
          type,
        };
      }

      return {
        category: "table",
        description: "",
        enabled: true,
        fieldConfig: { host: connectorField("Host", "string", true) },
        mode: "local",
        name: "PostgreSQL",
        type,
      };
    });
    getDataConnectRecordMock.mockReset();
    testDataConnectConfigMock.mockReset();
    testDataConnectConfigMock.mockResolvedValue(undefined);
    updateDataConnectRecordMock.mockReset();
    updateDataConnectRecordMock.mockResolvedValue(undefined);
    listDataConnectConnectorTypesMock.mockResolvedValue([
      {
        category: "table",
        description: "",
        enabled: true,
        fieldConfig: {
          host: {
            description: "",
            encrypted: false,
            name: "Host",
            required: true,
            type: "string",
          },
        },
        mode: "local",
        name: "PostgreSQL",
        type: "postgresql",
      },
    ]);
    getDataConnectRecordMock.mockResolvedValue({
      category: "table",
      connectorConfig: { host: "db.example.com" },
      connectorType: "postgresql",
      createTime: "-",
      creatorName: "-",
      description: "",
      enabled: true,
      expectedUpdateTime: 100,
      healthCheckResult: "",
      healthStatus: "healthy",
      id: "catalog-1",
      lastCheckTime: "-",
      metadata: {},
      mode: "local",
      name: "orders",
      operations: [],
      status: "enabled",
      tags: [],
      type: "physical",
      updateTime: "-",
      updaterName: "-",
    });
  });

  it("confirms before leaving a create form with unsaved changes", async () => {
    permissionState.values = new Set(["catalog:create"]);
    const onBack = vi.fn();

    render(<DataConnectFormScene mode="create" onBack={onBack} />);

    fireEvent.click(await findConnectorCard("PostgreSQL"));
    fireEvent.click(screen.getByRole("button", { name: "common.next" }));
    fireEvent.change(await screen.findByPlaceholderText("dataConnect.namePlaceholder"), {
      target: { value: "orders" },
    });
    fireEvent.click(screen.getByRole("button", { name: /common\.back/ }));

    expect(modalConfirmMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cancelText: "common.cancel",
        content: "dataConnect.discardChangesDescription",
        okText: "dataConnect.discardChangesConfirm",
        title: "dataConnect.discardChangesTitle",
      }),
    );
    expect(onBack).not.toHaveBeenCalled();

    const onOk = modalConfirmMock.mock.calls[0]?.[0]?.onOk;
    if (!onOk) {
      throw new Error("Expected the discard confirmation to provide an onOk callback");
    }
    onOk();
    expect(onBack).toHaveBeenCalledOnce();
  }, HEAVY_SCENE_TIMEOUT_MS);

  it("leaves immediately when the form has no user changes", async () => {
    permissionState.values = new Set(["catalog:create"]);
    const onBack = vi.fn();

    render(<DataConnectFormScene mode="create" onBack={onBack} />);

    await findConnectorCard("PostgreSQL");
    fireEvent.click(screen.getByRole("button", { name: /common\.back/ }));

    expect(modalConfirmMock).not.toHaveBeenCalled();
    expect(onBack).toHaveBeenCalledOnce();
  }, HEAVY_SCENE_TIMEOUT_MS);

  afterEach(() => {
    vi.useRealTimers();
  });

  it("hides the preflight action without catalog create permission", async () => {
    render(<DataConnectFormScene mode="edit" recordId="catalog-1" />);

    await screen.findByDisplayValue("orders");

    expect(
      screen.queryByRole("button", { name: "common.testConnection" }),
    ).toBeNull();
  });

  it("tests connector fields even when an unrelated catalog field is invalid", async () => {
    permissionState.values.add("catalog:create");
    render(<DataConnectFormScene mode="edit" recordId="catalog-1" />);

    const nameInput = await screen.findByDisplayValue("orders");
    fireEvent.change(nameInput, { target: { value: "" } });
    fireEvent.click(
      screen.getByRole("button", { name: "common.testConnection" }),
    );

    await waitFor(() => {
      expect(testDataConnectConfigMock).toHaveBeenCalledWith({
        connectorConfig: { host: "db.example.com" },
        connectorType: "postgresql",
      });
    });
    expect(messageSuccessMock).toHaveBeenCalledWith(
      "dataConnect.testConnectionSuccess",
    );
  });

  it("shows backend connection details when the preflight fails", async () => {
    permissionState.values.add("catalog:create");
    testDataConnectConfigMock.mockRejectedValue(
      new Error("dial tcp db.example.com:3306: i/o timeout"),
    );
    render(<DataConnectFormScene mode="edit" recordId="catalog-1" />);

    await screen.findByDisplayValue("orders");
    fireEvent.click(
      screen.getByRole("button", { name: "common.testConnection" }),
    );

    await waitFor(() => {
      expect(messageErrorMock).toHaveBeenCalledWith(
        "dial tcp db.example.com:3306: i/o timeout",
      );
    });
    expect(messageSuccessMock).not.toHaveBeenCalled();
  });

  it("reloads the latest record after an update conflict", async () => {
    updateDataConnectRecordMock.mockRejectedValue({
      isAxiosError: true,
      response: { status: 409 },
    });
    getDataConnectRecordMock
      .mockResolvedValueOnce({
        category: "table",
        connectorConfig: { host: "db.example.com" },
        connectorType: "postgresql",
        createTime: "-",
        creatorName: "-",
        description: "",
        enabled: true,
        expectedUpdateTime: 100,
        healthCheckResult: "",
        healthStatus: "healthy",
        id: "catalog-1",
        lastCheckTime: "-",
        metadata: {},
        mode: "local",
        name: "orders",
        operations: [],
        status: "enabled",
        tags: [],
        type: "physical",
        updateTime: "-",
        updaterName: "-",
      })
      .mockResolvedValueOnce({
        category: "table",
        connectorConfig: { host: "db.example.com" },
        connectorType: "postgresql",
        createTime: "-",
        creatorName: "-",
        description: "changed elsewhere",
        enabled: true,
        expectedUpdateTime: 200,
        healthCheckResult: "",
        healthStatus: "healthy",
        id: "catalog-1",
        lastCheckTime: "-",
        metadata: {},
        mode: "local",
        name: "latest orders",
        operations: [],
        status: "enabled",
        tags: [],
        type: "physical",
        updateTime: "-",
        updaterName: "-",
      });

    render(<DataConnectFormScene mode="edit" recordId="catalog-1" />);

    await screen.findByDisplayValue("orders");
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    expect(await screen.findByDisplayValue("latest orders")).toBeTruthy();
    expect(getDataConnectRecordMock).toHaveBeenCalledTimes(2);
    expect(updateDataConnectRecordMock).toHaveBeenCalledWith(
      "catalog-1",
      expect.objectContaining({ expectedUpdateTime: 100 }),
      { skipErrorToast: true },
    );
  });

  it("normalizes SQL Server schemas and options in the connection test request", async () => {
    permissionState.values.add("catalog:create");
    mockSQLServerEditCatalog({ "connection timeout": 15, encrypt: true });

    render(<DataConnectFormScene mode="edit" recordId="catalog-sqlserver" />);

    await screen.findByDisplayValue("sqlserver-orders");
    fireEvent.click(
      screen.getByRole("button", { name: "common.testConnection" }),
    );

    await waitFor(() => {
      expect(testDataConnectConfigMock).toHaveBeenCalledWith({
        connectorConfig: {
          database: "orders",
          host: "sqlserver.example.com",
          options: { "connection timeout": 15, encrypt: true },
          password: "test-password",
          port: 1433,
          schemas: ["sales", "audit"],
          username: "readonly_user",
        },
        connectorType: "sqlserver",
      });
    });
  });

  it("rejects invalid JSON options before testing the connection", async () => {
    permissionState.values.add("catalog:create");
    mockSQLServerEditCatalog({ encrypt: true });

    render(<DataConnectFormScene mode="edit" recordId="catalog-sqlserver" />);

    await screen.findByDisplayValue("sqlserver-orders");
    fireEvent.change(
      screen.getByPlaceholderText(
        '例如 {"encrypt":true,"trustservercertificate":false}',
      ),
      { target: { value: "{invalid" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "common.testConnection" }),
    );

    expect(
      await screen.findByText(
        "dataConnect.jsonObjectInvalid",
        {},
        { timeout: 5_000 },
      ),
    ).toBeTruthy();
    expect(testDataConnectConfigMock).not.toHaveBeenCalled();
  });

  it("omits object fields cleared to an empty string", async () => {
    permissionState.values.add("catalog:create");
    mockSQLServerEditCatalog({ encrypt: true });

    render(<DataConnectFormScene mode="edit" recordId="catalog-sqlserver" />);

    await screen.findByDisplayValue("sqlserver-orders");
    fireEvent.change(
      screen.getByPlaceholderText(
        '例如 {"encrypt":true,"trustservercertificate":false}',
      ),
      { target: { value: "   " } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "common.testConnection" }),
    );

    await waitFor(() => {
      expect(testDataConnectConfigMock).toHaveBeenCalledWith({
        connectorConfig: {
          database: "orders",
          host: "sqlserver.example.com",
          password: "test-password",
          port: 1433,
          schemas: ["sales", "audit"],
          username: "readonly_user",
        },
        connectorType: "sqlserver",
      });
    });
  });

  it("omits null options returned by the backend from the connection test", async () => {
    permissionState.values.add("catalog:create");
    mockSQLServerEditCatalog(null);

    render(<DataConnectFormScene mode="edit" recordId="catalog-sqlserver" />);

    await screen.findByDisplayValue("sqlserver-orders");
    fireEvent.click(
      screen.getByRole("button", { name: "common.testConnection" }),
    );

    await waitFor(() => {
      expect(testDataConnectConfigMock).toHaveBeenCalledWith({
        connectorConfig: {
          database: "orders",
          host: "sqlserver.example.com",
          password: "test-password",
          port: 1433,
          schemas: ["sales", "audit"],
          username: "readonly_user",
        },
        connectorType: "sqlserver",
      });
    });
  });

  it("omits empty optional encrypted fields from the connection test", async () => {
    permissionState.values.add("catalog:create");
    mockSQLServerEditCatalog({}, { api_token: "" });

    render(<DataConnectFormScene mode="edit" recordId="catalog-sqlserver" />);

    await screen.findByDisplayValue("sqlserver-orders");
    fireEvent.click(
      screen.getByRole("button", { name: "common.testConnection" }),
    );

    await waitFor(() => {
      expect(testDataConnectConfigMock).toHaveBeenCalledWith({
        connectorConfig: {
          database: "orders",
          host: "sqlserver.example.com",
          options: {},
          password: "test-password",
          port: 1433,
          schemas: ["sales", "audit"],
          username: "readonly_user",
        },
        connectorType: "sqlserver",
      });
    });
  });

  it("trims and preserves empty or null-like values outside options", async () => {
    permissionState.values.add("catalog:create");
    mockSQLServerEditCatalog(
      {},
      {
        application_name: "   ",
        host: "  null  ",
        password: "  padded-password  ",
        session_settings: { ansi_nulls: true },
      },
    );

    render(<DataConnectFormScene mode="edit" recordId="catalog-sqlserver" />);

    await screen.findByDisplayValue("sqlserver-orders");
    fireEvent.click(
      screen.getByRole("button", { name: "common.testConnection" }),
    );

    await waitFor(() => {
      expect(testDataConnectConfigMock).toHaveBeenCalledWith({
        connectorConfig: {
          application_name: "",
          database: "orders",
          host: "null",
          options: {},
          password: "  padded-password  ",
          port: 1433,
          schemas: ["sales", "audit"],
          session_settings: { ansi_nulls: true },
          username: "readonly_user",
        },
        connectorType: "sqlserver",
      });
    });
  });

  /**
   * When the backend disables an authenticated connector, treat it as an entitlement restriction:
   * render a selectable edition badge and show upgrade guidance instead of an unavailable state.
   */
  it("认证连接器被后端关掉时给升级引导,不画「暂不可用」", async () => {
    permissionState.values = new Set(["catalog:create"]);

    render(<DataConnectFormScene mode="create" />);

    const sqlServerButton = await findConnectorCard("SQL Server");

    expect(sqlServerButton.hasAttribute("disabled")).toBe(false);
    expect(sqlServerButton.textContent).toContain("关系型数据库");
    expect(sqlServerButton.textContent).not.toContain("dataConnect.connectorTypeUnavailable");
    expect(sqlServerButton.textContent).toContain(
      "common.entitlement.editionsShort.professional",
    );

    fireEvent.click(sqlServerButton);

    // 点击不选中,只弹引导;下一步仍走不通。
    expect(sqlServerButton.className).not.toContain("cardActive");
    expect(screen.getAllByText("common.entitlement.unlockTitle").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "common.next" }));

    expect(screen.queryByPlaceholderText("例如 供应链主库")).toBeNull();
  }, HEAVY_SCENE_TIMEOUT_MS);

  /**
   * 证书已经覆盖这项能力时,后端仍然关着它就不是钱的事,是这套部署没提供。这时说
   * 「请升级镜像」既指错方向,也把 bkn-safe 的镜像状态硬安到 Vega 头上。
   */
  it("装了且证够时不再推销,照普通连接器画「暂不可用」", async () => {
    permissionState.values = new Set(["catalog:create"]);
    entitlementState.snapshot = {
      capabilities: ["connector_certified", "rbac_basic"],
      edition: "enterprise",
      extensions: ["connector_certified", "rbac_basic"],
    };

    render(<DataConnectFormScene mode="create" />);

    const sqlServerButton = await findConnectorCard("SQL Server");

    expect(sqlServerButton.hasAttribute("disabled")).toBe(true);
    expect(sqlServerButton.textContent).toContain("dataConnect.connectorTypeUnavailable");
    expect(sqlServerButton.textContent).not.toContain(
      "common.entitlement.editionsShort.professional",
    );
  }, HEAVY_SCENE_TIMEOUT_MS);

  /**
   * 企业证 + 社区 vega:能力两个列表里都没有,是 `not-installed` 而不是 `unknown`。
   * 该说的是「换镜像」,不是「买证书」——客户已经买过了,弹窗里不该再出购买按钮。
   */
  it("证够了但镜像不含 → 说换镜像,不出购买按钮", async () => {
    permissionState.values = new Set(["catalog:create"]);
    entitlementState.snapshot = {
      capabilities: ["rbac_basic"],
      edition: "enterprise",
      extensions: ["rbac_basic"],
    };

    render(<DataConnectFormScene mode="create" />);

    fireEvent.click(await findConnectorCard("SQL Server"));

    expect(screen.getAllByText("common.entitlement.imageMissingTitle").length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByText("common.entitlement.upgradeTo")).toBeNull();
  }, HEAVY_SCENE_TIMEOUT_MS);

  /**
   * 企业镜像 + 社区证:能力在 `extensions[]` 里、不在 `capabilities[]` 里。这是唯一
   * 「换一张证就能用」的状态,也是唯一该出商务信息的地方。
   */
  it("装了没买 → 画档位徽标并给升级引导", async () => {
    permissionState.values = new Set(["catalog:create"]);
    entitlementState.snapshot = {
      capabilities: [],
      edition: "community",
      extensions: ["connector_certified", "rbac_basic"],
    };

    render(<DataConnectFormScene mode="create" />);

    const sqlServerButton = await findConnectorCard("SQL Server");

    expect(sqlServerButton.hasAttribute("disabled")).toBe(false);
    expect(sqlServerButton.textContent).toContain(
      "common.entitlement.editionsShort.professional",
    );
  }, HEAVY_SCENE_TIMEOUT_MS);

  it("creates a SQL Server catalog with the default port", async () => {
    permissionState.values = new Set(["catalog:create"]);
    getDataConnectConnectorTypeMock.mockResolvedValue({
      category: "table",
      description: "Microsoft SQL Server 关系型数据库连接器",
      enabled: true,
      fieldConfig: {
        database: connectorField("数据库名", "string", true),
        host: connectorField("主机地址", "string", true),
        password: connectorField("密码", "string", true, true),
        port: connectorField("端口号", "integer", true),
        username: connectorField("用户名", "string", true),
      },
      mode: "local",
      name: "SQL Server",
      type: "sqlserver",
    });
    listDataConnectConnectorTypesMock.mockResolvedValue([
      {
        category: "table",
        description: "Microsoft SQL Server 关系型数据库连接器",
        enabled: true,
        fieldConfig: {
          host: connectorField("主机地址", "string", true),
          port: connectorField("端口号", "integer", true),
          username: connectorField("用户名", "string", true),
          password: connectorField("密码", "string", true, true),
          database: connectorField("数据库名", "string", true),
        },
        mode: "local",
        name: "SQL Server",
        type: "sqlserver",
      },
    ]);

    render(<DataConnectFormScene mode="create" />);

    fireEvent.click(await findConnectorCard("SQL Server"));
    fireEvent.click(screen.getByRole("button", { name: "common.next" }));

    fireEvent.change(await screen.findByPlaceholderText("dataConnect.namePlaceholder"), {
      target: { value: "sqlserver-orders" },
    });
    expect(getDataConnectConnectorTypeMock).toHaveBeenCalledWith("sqlserver");
    fireEvent.change(screen.getByPlaceholderText("例如 db.example.internal"), {
      target: { value: "sqlserver.example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("例如 readonly_user"), {
      target: { value: "readonly_user" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("dataConnect.encryptedFieldPlaceholder"),
      { target: { value: "test-password" } },
    );
    fireEvent.change(screen.getByPlaceholderText("例如 supply_chain"), {
      target: { value: "orders" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.confirm" }));

    await waitFor(() => {
      expect(createDataConnectRecordMock).toHaveBeenCalledWith(
        {
          connectorConfig: {
            database: "orders",
            host: "sqlserver.example.com",
            password: "test-password",
            port: 1433,
            username: "readonly_user",
          },
          connectorType: "sqlserver",
          description: "",
          enabled: true,
          healthCheckSchedule: { cronExpr: undefined, mode: "inherit" },
          name: "sqlserver-orders",
          tags: [],
        },
        { skipErrorToast: true },
      );
    });
  }, HEAVY_SCENE_TIMEOUT_MS);
});

function connectorField(
  _name: string,
  type: string,
  required: boolean,
  encrypted = false,
) {
  return {
    encrypted,
    required,
    type,
  };
}

function mockSQLServerEditCatalog(
  options: unknown,
  connectorConfigOverrides: Record<string, unknown> = {},
) {
  listDataConnectConnectorTypesMock.mockResolvedValue([
    {
      category: "table",
      description: "",
      enabled: true,
      fieldConfig: {
        host: connectorField("主机地址", "string", true),
        port: connectorField("端口号", "integer", true),
        username: connectorField("用户名", "string", true),
        password: connectorField("密码", "string", true, true),
        database: connectorField("数据库名", "string", true),
        schemas: connectorField("Schema 列表", "array", false),
        options: connectorField("连接参数", "object", false),
        application_name: connectorField("应用名称", "string", false),
        session_settings: connectorField("会话设置", "object", false),
        api_token: connectorField("API Token", "string", false, true),
      },
      mode: "local",
      name: "SQL Server",
      type: "sqlserver",
    },
  ]);
  getDataConnectRecordMock.mockResolvedValue({
    category: "table",
    connectorConfig: {
      database: "orders",
      host: "sqlserver.example.com",
      options,
      password: "test-password",
      port: 1433,
      schemas: ["sales", "audit"],
      username: "readonly_user",
      ...connectorConfigOverrides,
    },
    connectorType: "sqlserver",
    createTime: "-",
    creatorName: "-",
    description: "",
    enabled: true,
    healthCheckResult: "",
    healthStatus: "healthy",
    id: "catalog-sqlserver",
    lastCheckTime: "-",
    metadata: {},
    mode: "local",
    name: "sqlserver-orders",
    operations: [],
    status: "enabled",
    tags: [],
    type: "physical",
    updateTime: "-",
    updaterName: "-",
  });
}
