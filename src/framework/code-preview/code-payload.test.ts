/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";
import { countSourceLines, getCodePayload } from "./code-payload";

describe("代码参数提取", () => {
  it.each([
    ["多行 Python", "if True:\n    print('中文')\n"],
    ["没有换行的 AI 代码", "x = 1; y = 2; print(x + y)"],
    ["CRLF", "if True:\r\n\tprint(1)\r\n"],
    ["CR", "x = 1\rprint(x)"],
    ["混合换行", "a\r\nb\nc\rd"],
    ["字面量反斜杠", String.raw`message = "a\nb"; path = r"C:\new\test"`],
    ["连续空白及空行", "  \n\n\tprint(1)  \n"],
    ["空代码", ""],
    ["AI 输出的无效语法", "if True:print(1) else print(2)"],
    ["长单行", "print('" + "字".repeat(30_000) + "')"],
    ["HTML 与 Unicode", 'print("<img src=x onerror=alert(1)>🙂")'],
  ])("%s 保留每个原始字符", (_, code) => {
    const value = { code, language: "python", timeout: 30 };
    expect(getCodePayload(value)).toEqual({ code, language: "python" });
    expect(getCodePayload(JSON.stringify(value))).toEqual({ code, language: "python" });
    expect(value.code).toBe(code);
  });
  it.each([
    null,
    undefined,
    1,
    [],
    {},
    { code: null },
    { code: 123 },
    { code: {} },
    "bad json",
    '"print(1)"',
    JSON.stringify(JSON.stringify({ code: "x" })),
  ])("不猜测无效参数或重复解码：%j", (value) => {
    expect(getCodePayload(value)).toBeNull();
  });
  it("不从 Markdown 围栏中截取或补缩进", () => {
    const code = "\x60\x60\x60python\nprint(1)\n\x60\x60\x60";
    expect(getCodePayload({ code }, "python")).toEqual({ code, language: "python" });
  });
  it.each([
    ["PY", "python"],
    ["python3", "python"],
    [" js ", "javascript"],
    ["bash", "shell"],
    ["custom-query", "custom-query"],
  ])("规范化语言 %s", (input, expected) => {
    expect(getCodePayload({ code: "x", language: input })?.language).toBe(expected);
  });
  it.each(["constructor", "__proto__"])("未知语言 %s 不读取继承属性", (language) => {
    expect(getCodePayload({ code: "x", language })?.language).toBe(language);
  });
  it("缺失或非法语言由调用方给定默认值", () => {
    expect(getCodePayload({ code: "x", language: 1 }, "python")?.language).toBe("python");
    expect(getCodePayload({ code: "x", language: " " })?.language).toBe("plaintext");
  });
});
describe("源行计数", () => {
  it.each([
    ["", 0],
    ["x", 1],
    ["x\ny", 2],
    ["x\r\ny", 2],
    ["x\ry", 2],
    ["x\n", 2],
    [String.raw`x\ny`, 1],
    ["x".repeat(100_000), 1],
  ] as const)("根据真实换行计数：%j", (code, expected) => {
    expect(countSourceLines(code)).toBe(expected);
  });
});
