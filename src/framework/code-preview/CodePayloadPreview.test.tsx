/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { EditorProps } from "@monaco-editor/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/app/locales/i18n";
import { CodePayloadPreview } from "./CodePayloadPreview";

const { writeText, success, error, editorProps, failEditor } = vi.hoisted(() => ({
  writeText: vi.fn<(text: string) => Promise<void>>(),
  success: vi.fn(),
  error: vi.fn(),
  editorProps: [] as EditorProps[],
  failEditor: { value: false },
}));
vi.mock("@/framework/compat/clipboard", () => ({ writeTextToClipboard: writeText }));
vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: { success, error } }),
}));
vi.mock("@/framework/monaco/MonacoEditor", () => ({
  MonacoEditor: (props: EditorProps) => {
    editorProps.push(props);
    if (failEditor.value) throw new Error("editor chunk failed");
    return (
      <pre data-testid="readonly-editor" data-wrap={props.options?.wordWrap}>
        {props.value}
      </pre>
    );
  },
}));
beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  writeText.mockReset().mockResolvedValue(undefined);
  success.mockClear();
  error.mockClear();
  editorProps.length = 0;
  failEditor.value = false;
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

const preview = (code: string, language = "python") => {
  const rawText = JSON.stringify({ code, language, timeout: 30, extra: "保留的参数" }, null, 2);
  return {
    rawText,
    ...render(<CodePayloadPreview code={code} language={language} rawText={rawText} />),
  };
};
describe("代码载荷预览", () => {
  it.each([
    ["单行", "a = 1; b = 2; print(a + b)"],
    ["多行", "if True:\n    print(1)\n"],
    ["CRLF", "\tif True:\r\n\t\tprint('中文')\r\n"],
    ["CR 和混合换行", "a\rb\r\nc\n"],
    ["字面量反斜杠", String.raw`print("第一行\n第二行"); path = r"C:\new\test"`],
    ["没有缩进的错误代码", "if True:print(1) else print(2)"],
    ["Unicode与HTML", "<script>alert(1)</script>🙂中文"],
    ["长单行", "x".repeat(40_000)],
    ["长脚本", Array.from({ length: 2001 }, (_, i) => "print(" + i + ")").join("\n")],
  ])("%s：切换折行、放大后复制仍使用原文", async (_, code) => {
    preview(code);
    expect(screen.getByTestId("readonly-editor").textContent).toBe(code);
    fireEvent.click(screen.getByRole("button", { name: "自动折行" }));
    expect(screen.getByTestId("readonly-editor")).toHaveAttribute("data-wrap", "off");
    fireEvent.click(screen.getByRole("button", { name: "复制代码" }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(code));
    fireEvent.click(screen.getByRole("button", { name: "放大" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "复制代码" }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(code));
    expect(document.querySelector("script")).toBeNull();
  });
  it("原始参数完整保留，复制不混入预览状态", async () => {
    const { rawText } = preview("print('a\\nb')");
    fireEvent.click(screen.getByRole("tab", { name: "原始参数" }));
    expect(screen.getByLabelText("原始参数", { selector: "pre" }).textContent).toBe(rawText);
    fireEvent.click(screen.getByRole("button", { name: "复制参数" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(rawText));
    expect(screen.queryByTestId("readonly-editor")).toBeNull();
  });
  it("源行计数不受视觉折行影响", () => {
    preview("x".repeat(1000));
    expect(screen.getByText("1 个源代码行")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "自动折行" }));
    expect(screen.getByText("1 个源代码行")).toBeInTheDocument();
  });
  it("空代码有空态且不能复制或放大，原始参数仍可查看", () => {
    preview("");
    expect(screen.getByText("本次调用没有代码内容")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "复制代码" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "放大" })).toBeDisabled();
    fireEvent.click(screen.getByRole("tab", { name: "原始参数" }));
    expect(screen.getByRole("button", { name: "复制参数" })).toBeEnabled();
  });
  it("超大脚本使用完整文本回退，不初始化编辑器", async () => {
    const code = "x".repeat(200_001);
    preview(code);
    expect(screen.queryByTestId("readonly-editor")).toBeNull();
    expect(screen.getByLabelText("代码", { selector: "pre" }).textContent).toBe(code);
    fireEvent.click(screen.getByRole("button", { name: "复制代码" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(code));
  });
  it("只读选项关闭编辑、校验与符号后台高亮任务", () => {
    preview("x = 1");
    expect(editorProps[0].options).toMatchObject({
      readOnly: true,
      domReadOnly: true,
      occurrencesHighlight: "off",
      selectionHighlight: false,
      renderValidationDecorations: "off",
      minimap: { enabled: false },
      wordWrap: "on",
    });
  });
  it("编辑器加载失败仍能读取和复制完整代码", async () => {
    failEditor.value = true;
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    preview("if True:\n    print(1)");
    expect(screen.getByLabelText("代码", { selector: "pre" }).textContent).toBe(
      "if True:\n    print(1)",
    );
    fireEvent.click(screen.getByRole("button", { name: "复制代码" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("if True:\n    print(1)"));
    spy.mockRestore();
  });
  it("复制失败显示失败反馈，不误报成功", async () => {
    writeText.mockRejectedValueOnce(new Error("denied"));
    preview("x");
    fireEvent.click(screen.getByRole("button", { name: "复制代码" }));
    await waitFor(() => expect(error).toHaveBeenCalledWith("复制失败"));
    expect(success).not.toHaveBeenCalled();
  });
  it("参数页签支持键盘切换并保留源代码", () => {
    preview("a\nb");
    fireEvent.keyDown(screen.getByRole("tab", { name: "代码" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "原始参数" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "原始参数" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("tab", { name: "原始参数" }), { key: "Home" });
    expect(screen.getByTestId("readonly-editor").textContent).toBe("a\nb");
  });
  it("英文文案及单复数正确", async () => {
    await i18n.changeLanguage("en-US");
    const { rerender } = preview("x");
    expect(screen.getByText("1 source line")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy code" })).toBeInTheDocument();
    rerender(<CodePayloadPreview code={"x\ny"} language="python" rawText="{}" />);
    expect(screen.getByText("2 source lines")).toBeInTheDocument();
    await act(async () => {
      await i18n.changeLanguage("zh-CN");
    });
  });
});
