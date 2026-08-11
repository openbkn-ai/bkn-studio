/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { APICallError, TypeValidationError } from "ai";
import { describe, expect, it } from "vitest";

import { normalizeAgentError, parseModelFactoryEnvelope } from "@/modules/knowledge-network/services/agent-error";

/** Real model-factory busy envelope where description/detail are JSON strings wrapping JSON; see bkn-foundry#620. */
const busyEnvelope = {
  code: "ModelFactory.ModelController.Model.Error",
  description: '{"code":50508,"message":"System is too busy now. Please try again later.","data":null}',
  detail: '{"code":50508,"message":"System is too busy now. Please try again later.","data":null}',
  solution: "请检查配置信息",
  link: "",
};

/**
 * Another envelope from the same gateway: description wraps a forwarded OpenAI-style error and
 * code is a string. The outer code is always a classification string and must not be treated as an error code.
 */
const upstreamBusyEnvelope = {
  code: "ModelFactory.ModelController.Model.Error",
  description:
    '{"error":{"message":"Service is too busy. We advise users to temporarily switch to alternative LLM API service providers.","type":"service_unavailable_error","param":null,"code":"service_unavailable_error"}}',
  detail:
    '{"error":{"message":"Service is too busy. We advise users to temporarily switch to alternative LLM API service providers.","type":"service_unavailable_error","param":null,"code":"service_unavailable_error"}}',
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

  it("解开 description 里再裹一层的上游 error，并保留字符串码", () => {
    expect(parseModelFactoryEnvelope(upstreamBusyEnvelope)).toEqual({
      code: "service_unavailable_error",
      message: "Service is too busy. We advise users to temporarily switch to alternative LLM API service providers.",
    });
  });

  it("不把外层的分类串当错误码", () => {
    // If description cannot be parsed, fall back only to the outer layer, which has no message and must not expose ModelFactory.* as a code.
    expect(parseModelFactoryEnvelope({ code: "ModelFactory.ModelController.Model.Error", description: "not json" })).toBeNull();
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
    // The user-facing sentence must not expose Zod errors or the raw envelope.
    expect(normalized.message).not.toContain("Type validation failed");
    expect(normalized.message).not.toContain("invalid_union");
    expect(normalized.detail).toContain("ModelFactory.ModelController.Model.Error");
  });

  it("上游透传的 service_unavailable_error 同样翻成人话且判可重试", () => {
    const error = new TypeValidationError({ value: upstreamBusyEnvelope, cause: new Error("invalid_union") });

    const normalized = normalizeAgentError(error);

    expect(normalized.message).toBe("模型服务繁忙，上游建议暂时改用其他模型（service_unavailable_error）");
    expect(normalized.retryable).toBe(true);
    expect(normalized.message).not.toContain("Type validation failed");
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

  it("网关按契约返错后只剩一句 message 时，仍认得出忙态并给重试", () => {
    // Since bkn-foundry#624, streaming HTTP remains 200 and errors use SSE error frames. AI SDK
    // chat models expose only error.message, losing business codes, so classification must use text.
    const normalized = normalizeAgentError(
      "Service is too busy. We advise users to temporarily switch to alternative LLM API service providers.",
    );

    expect(normalized.message).toBe("模型服务繁忙，请稍后重试");
    expect(normalized.retryable).toBe(true);
  });

  it("error 帧以纯对象到达时按结构解，不退化成 [object Object]", () => {
    const normalized = normalizeAgentError({
      error: { message: "Rate limit reached", type: "rate_limit_exceeded", code: "rate_limit_exceeded" },
    });

    expect(normalized.message).toBe("模型服务被限流，请稍后重试（rate_limit_exceeded）");
    expect(normalized.retryable).toBe(true);
    expect(normalized.message).not.toContain("[object Object]");
  });

  it("解析报错被重新包装成普通 Error 后，仍然不把 zod 原文贴给用户", () => {
    // isInstance no longer recognizes it, leaving only text matching. Without this fallback, the
    // bubble again exposes `Type validation failed: Value: {...`, which this module must eliminate.
    const rewrapped = new Error(
      'Type validation failed: Value: {"code":"ModelFactory.ModelController.Model.Error"}. Error message: [{"code":"invalid_union"}]',
    );

    const normalized = normalizeAgentError(rewrapped);

    expect(normalized.message).toBe("模型服务返回了无法解析的响应，请稍后重试或联系管理员");
    expect(normalized.message).not.toContain("Type validation failed");
    expect(normalized.detail).toContain("invalid_union");
  });

  it("普通 SQL 报错不会被忙态规则误伤", () => {
    // tool-error uses the same normalization; before narrowing broad terms such as `capacity`, it was translated as model service busy.
    const normalized = normalizeAgentError(new Error('column "capacity" does not exist'));

    expect(normalized.message).toBe('column "capacity" does not exist');
    expect(normalized.retryable).toBe(false);
  });

  it("未知错误保留原文但不判可重试", () => {
    const normalized = normalizeAgentError(new Error("something odd"));

    expect(normalized.message).toBe("something odd");
    expect(normalized.retryable).toBe(false);
  });
});
