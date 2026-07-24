/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  QuickAddApiForm,
  type QuickAddApiFormHandle,
} from "@/modules/execution-factory/components/create-menu/QuickAddApiForm";

const SCREENSHOT_CURL = `curl -X POST https://httpbin.org/post \\
  -H "Content-Type: application/json" \\
  -d '{"name":"test","message":"hello"}'`;

const translate = (key: string) => key;

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  })),
});

vi.mock("react-i18next", () => ({
  initReactI18next: { init: vi.fn(), type: "3rdParty" },
  useTranslation: () => ({ t: translate }),
}));

vi.mock("@/modules/execution-factory/services/toolbox.service", () => ({
  listToolboxes: vi.fn(() => Promise.resolve({ items: [] })),
}));

vi.mock("@/modules/execution-factory/components/CapabilityBusinessIntro", () => ({
  CapabilityBusinessIntro: () => null,
  ToolboxPlacementIntro: () => null,
}));

vi.mock("@/modules/execution-factory/components/CapabilityCategoryFields", () => ({
  CapabilityCategoryFields: () => null,
}));

vi.mock("@/modules/execution-factory/components/OperatorSyncPublishFields", () => ({
  OperatorSyncPublishFields: () => null,
}));

function renderForm(onSubmit: ReturnType<typeof vi.fn>) {
  const ref = createRef<QuickAddApiFormHandle>();
  render(<QuickAddApiForm formId="quick-add-api" onSubmit={onSubmit} ref={ref} />);
  return ref;
}

function fillField(id: string, value: string) {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`field ${id} not found`);
  }
  fireEvent.change(node, { target: { value } });
}

/** Mirrors the screenshot: name + toolbox filled, cURL pasted, 识别接口信息 not clicked. */
function fillRequiredFields(curl: string) {
  fillField("curlText", curl);
  fillField("summary", "在线工具");
  fillField("toolboxName", "在线工具测试");
}

describe("QuickAddApiForm cURL submit", () => {
  afterEach(() => {
    cleanup();
  });

  it("parses the cURL on submit even when 识别接口信息 was never clicked", async () => {
    const onSubmit = vi.fn();
    const ref = renderForm(onSubmit);

    fillRequiredFields(SCREENSHOT_CURL);
    ref.current?.submit();

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const payload = onSubmit.mock.calls[0][0] as { openapiSpec: string; serviceUrl: string };
    const document = JSON.parse(payload.openapiSpec) as {
      servers: Array<{ url: string }>;
      paths: Record<string, Record<string, unknown>>;
    };

    expect(document.servers[0].url).toBe("https://httpbin.org");
    expect(Object.keys(document.paths)).toEqual(["/post"]);
    expect(document.paths["/post"].post).toBeTruthy();
  });

  /**
   * 回归:点过「识别接口信息」后 detectedCurlContract 不会随输入框失效,而它会整体覆盖
   * method/serverUrl/path/parameters/requestBody。旧实现提交时只在「从没识别过」才重解析,
   * 于是识别 A 再改成 B 提交,会静默按 A 建工具,界面上却是 B。
   */
  it("re-parses on submit when the cURL changed after 识别接口信息 was clicked", async () => {
    const onSubmit = vi.fn();
    const ref = renderForm(onSubmit);

    fillRequiredFields(SCREENSHOT_CURL);
    fireEvent.click(screen.getAllByText("executionFactory.quickApiParseAction")[0]);

    // 识别之后再把命令换成另一个 host/path/method。
    fillField("curlText", "curl -X PUT https://beta.example.com/two");
    ref.current?.submit();

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const payload = onSubmit.mock.calls[0][0] as { openapiSpec: string };
    const document = JSON.parse(payload.openapiSpec) as {
      servers: Array<{ url: string }>;
      paths: Record<string, Record<string, unknown>>;
    };

    expect(document.servers[0].url).toBe("https://beta.example.com");
    expect(Object.keys(document.paths)).toEqual(["/two"]);
    expect(document.paths["/two"].put).toBeTruthy();
    expect(document.paths["/two"].post).toBeFalsy();
  });

  it("reports the concrete parse reason instead of the generic build failure", async () => {
    const onSubmit = vi.fn();
    const ref = renderForm(onSubmit);

    fillRequiredFields("wget https://httpbin.org/post");
    ref.current?.submit();

    await waitFor(() => {
      expect(
        screen.getAllByText("请输入以 curl 开头的命令，或直接切换到表单模式填写。").length,
      ).toBeGreaterThan(0);
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
