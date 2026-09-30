/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Form } from "antd";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import { DataConnectConfigForm } from "@/modules/data-connect/components/DataConnectConfigForm";
import type { DataConnectConnectorType } from "@/modules/data-connect/types/data-connect";

const mariaDbConnector: DataConnectConnectorType = {
  available: true,
  category: "table",
  description: "MariaDB connector",
  enabled: true,
  fieldConfig: {
    databases: { encrypted: false, required: false, type: "array" },
    host: { encrypted: false, required: true, type: "string" },
    options: { encrypted: false, required: false, type: "object" },
    password: { encrypted: true, required: true, type: "string" },
    port: { encrypted: false, required: true, type: "integer" },
    username: { encrypted: false, required: true, type: "string" },
  },
  mode: "local",
  name: "MariaDB",
  type: "mariadb",
};

function hasGroupTitle(title: string) {
  return [...document.querySelectorAll("[class*='_groupTitle_']")].some(
    (element) => element.textContent === title,
  );
}

describe("DataConnectConfigForm", () => {
  beforeEach(async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      addEventListener: () => undefined,
      addListener: () => undefined,
      dispatchEvent: () => false,
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: () => undefined,
      removeListener: () => undefined,
    }));
    await i18n.changeLanguage("zh-CN");
  });

  afterEach(async () => {
    await i18n.changeLanguage("zh-CN");
  });

  it("updates connector group titles when the active locale changes", async () => {
    render(
      <Form>
        <DataConnectConfigForm selectedConnectorType={mariaDbConnector} />
      </Form>,
    );

    expect(hasGroupTitle("连接参数")).toBe(true);
    expect(hasGroupTitle("认证信息")).toBe(true);
    expect(hasGroupTitle("高级设置")).toBe(true);
    expect(screen.getByText("主机地址")).not.toBeNull();

    await act(async () => {
      await i18n.changeLanguage("en-US");
    });

    expect(hasGroupTitle("Connection parameters")).toBe(true);
    expect(hasGroupTitle("Authentication")).toBe(true);
    expect(hasGroupTitle("Advanced settings")).toBe(true);
    expect(screen.getByText("Host")).not.toBeNull();
    expect(hasGroupTitle("连接参数")).toBe(false);
    expect(screen.queryByText("主机地址")).toBeNull();
  });

  it("keeps database discovery automatic when empty and adds database names individually", async () => {
    const onFinish = vi.fn();

    render(
      <Form
        initialValues={{
          connectorConfig: {
            host: "db.example.internal",
            password: "secret",
            port: 3306,
            username: "readonly_user",
          },
          enabled: true,
          healthCheckSchedule: { mode: "inherit" },
          name: "MariaDB connection",
        }}
        onFinish={onFinish}
      >
        <DataConnectConfigForm selectedConnectorType={mariaDbConnector} />
        <button type="submit">Submit</button>
      </Form>,
    );

    const databaseInput = screen
      .getByText("留空自动发现全部数据库；输入名称后按回车逐个添加")
      .closest(".ant-select")
      ?.querySelector("input");

    expect(screen.getByText("填写时必须与数据库中的实际名称及大小写完全一致")).not.toBeNull();
    expect(databaseInput).not.toBeNull();
    if (!databaseInput) {
      return;
    }

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(onFinish).toHaveBeenCalled());
    expect(getLastConnectorConfig(onFinish).databases).toBeUndefined();

    fireEvent.change(databaseInput, { target: { value: "sales" } });
    fireEvent.keyDown(databaseInput, {
      code: "Enter",
      key: "Enter",
      keyCode: 13,
      which: 13,
    });
    fireEvent.change(databaseInput, { target: { value: "reporting" } });
    fireEvent.keyDown(databaseInput, {
      code: "Enter",
      key: "Enter",
      keyCode: 13,
      which: 13,
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() =>
      expect(getLastConnectorConfig(onFinish).databases).toEqual(["sales", "reporting"]),
    );
  });

  it("stops at five catalog tags and reports an attempted sixth tag", async () => {
    const onFinish = vi.fn();
    render(
      <Form
        initialValues={{
          connectorConfig: {
            host: "db.example.internal",
            password: "secret",
            port: 3306,
            username: "reader",
          },
          healthCheckSchedule: { mode: "inherit" },
          name: "Catalog",
        }}
        onFinish={onFinish}
      >
        <DataConnectConfigForm selectedConnectorType={mariaDbConnector} />
        <button type="submit">Submit</button>
      </Form>,
    );

    const tagsField = screen
      .getByText("最多 5 个标签，每个不超过 40 个字符")
      .closest(".ant-form-item");
    const input = tagsField?.querySelector(".ant-select input");
    expect(input).not.toBeNull();
    if (!input) return;

    for (const tag of ["one", "two", "three", "four", "five", "six"]) {
      fireEvent.change(input, { target: { value: tag } });
      fireEvent.keyDown(input, { code: "Enter", key: "Enter", keyCode: 13, which: 13 });
    }

    expect(tagsField?.querySelectorAll(".ant-select-selection-item")).toHaveLength(5);
    expect(screen.getByRole("alert").textContent).toContain("标签最多只能填写 5 个");
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() =>
      expect(onFinish).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ["one", "two", "three", "four", "five"] }),
      ),
    );

    fireEvent.click(tagsField?.querySelector(".ant-select-selection-item-remove") as HTMLElement);
    expect(screen.queryByRole("alert")).toBeNull();
    for (const [tag, message] of [
      ["bad/tag", "标签不能包含"],
      ["😀".repeat(41), "单个标签不能超过 40 个字符"],
      ["   ", "标签不能为空"],
    ]) {
      fireEvent.change(input, { target: { value: tag } });
      fireEvent.keyDown(input, { code: "Enter", key: "Enter", keyCode: 13, which: 13 });
      expect(tagsField?.querySelectorAll(".ant-select-selection-item")).toHaveLength(4);
      expect(screen.getByRole("alert").textContent).toContain(message);
    }
    fireEvent.change(input, { target: { value: `  ${"😀".repeat(40)}  ` } });
    fireEvent.keyDown(input, { code: "Enter", key: "Enter", keyCode: 13, which: 13 });
    expect(tagsField?.querySelectorAll(".ant-select-selection-item")).toHaveLength(5);
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() =>
      expect(onFinish).toHaveBeenLastCalledWith(
        expect.objectContaining({ tags: ["two", "three", "four", "five", "😀".repeat(40)] }),
      ),
    );
  });

  it("limits catalog name and description by Unicode characters", () => {
    render(
      <Form>
        <DataConnectConfigForm selectedConnectorType={mariaDbConnector} />
      </Form>,
    );
    const name = screen.getByPlaceholderText("例如 供应链主库");
    fireEvent.change(name, { target: { value: "😀".repeat(255) } });
    expect(name).toHaveValue("😀".repeat(255));
    fireEvent.change(name, { target: { value: "😀".repeat(256) } });
    expect(name).toHaveValue("😀".repeat(255));

    const description = screen.getByPlaceholderText("简要说明用途（可选）");
    fireEvent.change(description, { target: { value: "😀".repeat(1000) } });
    expect(description).toHaveValue("😀".repeat(1000));
    fireEvent.change(description, { target: { value: "😀".repeat(1001) } });
    expect(description).toHaveValue("😀".repeat(1000));
  });
});

function getLastConnectorConfig(onFinish: ReturnType<typeof vi.fn>) {
  const payload = onFinish.mock.lastCall?.[0] as
    { connectorConfig: { databases?: string[] } } | undefined;

  if (!payload) {
    throw new Error("Expected the form submission handler to be called");
  }

  return payload.connectorConfig;
}
