/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { APICallError, TypeValidationError } from "ai";
import { describe, expect, it } from "vitest";

import { normalizeAgentError, parseModelFactoryEnvelope } from "@/modules/knowledge-network/services/agent-error";

/** 模型工厂忙态返回的真实 envelope（description/detail 是 JSON 字符串套 JSON）。见 bkn-foundry#620。 */
const busyEnvelope = {
  code: "ModelFactory.ModelController.Model.Error",
  description: '{"code":50508,"message":"System is too busy now. Please try again later.","data":null}',
  detail: '{"code":50508,"message":"System is too busy now. Please try again later.","data":null}',
  solution: "请检查配置信息",
  link: "",
};

describe("parseModelFactoryEnvelope", () => {
  it("解开双层 JSON 编码的模型工厂 envelope", () => {
    expect(parseModelFactoryEnvelope(busyEnvelope)).toEqual({
      code: 50508,
      message: "System is too busy now. Please try again later.",
    });
  });

  it("同样认 OpenAI 兼容的 error 形态（网关修好后就是这个）", () => {
    expect(parseModelFactoryEnvelope({ error: { message: "rate limited", code: 429 } })).toEqual({
      code: 429,
      message: "rate limited",
    });
  });

  it("非结构化的裸串不误判成业务错误", () => {
    expect(parseModelFactoryEnvelope("network error")).toBeNull();
  });
});

describe("normalizeAgentError", () => {
  it("TypeValidationError 裹着模型工厂忙态 → 中文短文案 + 可重试，原文进 detail", () => {
    const error = new TypeValidationError({ value: busyEnvelope, cause: new Error("invalid_union") });

    const normalized = normalizeAgentError(error);

    expect(normalized.message).toBe("模型服务繁忙，请稍后重试（50508）");
    expect(normalized.retryable).toBe(true);
    // 用户看到的一句话里不能出现 zod 报错或原始 envelope。
    expect(normalized.message).not.toContain("Type validation failed");
    expect(normalized.message).not.toContain("invalid_union");
    expect(normalized.detail).toContain("ModelFactory.ModelController.Model.Error");
  });

  it("解不出业务码的 TypeValidationError 也不把 zod 报错糊给用户", () => {
    const error = new TypeValidationError({ value: { unexpected: true }, cause: new Error("invalid_union") });

    const normalized = normalizeAgentError(error);

    expect(normalized.message).toBe("模型服务返回了无法解析的响应，请稍后重试或联系管理员");
    expect(normalized.retryable).toBe(false);
    expect(normalized.detail).toContain("unexpected");
  });

  it("APICallError 按状态码给文案，5xx 判可重试", () => {
    const error = new APICallError({
      message: "Service Unavailable",
      url: "https://example.test/v1/chat/completions",
      requestBodyValues: {},
      statusCode: 503,
      responseBody: "upstream down",
    });

    const normalized = normalizeAgentError(error);

    expect(normalized.message).toBe("模型服务暂时不可用，请稍后重试");
    expect(normalized.retryable).toBe(true);
    expect(normalized.detail).toContain("upstream down");
  });

  it("裸 network error 翻成人话并判可重试", () => {
    expect(normalizeAgentError(new Error("network error"))).toEqual({
      message: "与模型服务的连接中断，请重试",
      detail: "network error",
      retryable: true,
    });
  });

  it("未知错误保留原文但不判可重试", () => {
    const normalized = normalizeAgentError(new Error("something odd"));

    expect(normalized.message).toBe("something odd");
    expect(normalized.retryable).toBe(false);
  });
});
