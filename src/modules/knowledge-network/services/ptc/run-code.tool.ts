/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * PTC（代码化工具调用）模式的唯一工具。
 *
 * 常规模式把 20 个 BKN 能力逐个暴露给模型，每次调用的完整返回都进上下文。
 * PTC 模式只暴露 run_code：模型写一段 Python，沙箱执行，脚本内经 MCP 调那些
 * 能力，中间结果留在沙箱，只有 stdout 回到上下文。
 *
 * 收益不在“省 token”这一项上——能用一条 SQL 表达的统计，常规模式下模型自己就
 * 会选 run_sql 把聚合下推到数据库。真正的差别在 SQL 覆盖不到的地方：跨工具编
 * 排、非 SQL 数据源、扇出、按中间结果分支。
 */

import { jsonSchema, tool, type ToolSet } from "ai";

import { http } from "@/framework/request/http";

import { AGENT_OPERATOR_API_PREFIX, getAgentOperatorHeaders } from "../shared/agent-operator-client";
import type { PtcToolkit } from "./toolkit.service";

/** 沙箱按 AWS Lambda 规范执行，入口必须是单参数的 handler(event)。 */
function wrapForSandbox(stubSource: string, code: string): string {
  const body = code
    .split("\n")
    .map((line) => (line.trim() ? `    ${line}` : line))
    .join("\n");
  return `${stubSource}\n\ndef handler(event):\n    _configure(event)\n${body}\n`;
}

type ExecuteResponse = {
  stdout?: string;
  stderr?: string;
  error_message?: string;
  exit_code?: number;
};

export type PtcToolOptions = {
  /** 由 context-loader 渲染的工具包：说明、沙箱 stub 与回访地址。 */
  toolkit: PtcToolkit;
  /** 本轮的会话生命周期上下文，来源与常规模式一致。 */
  bknContext: () => Record<string, unknown> | undefined;
  /**
   * 沙箱访问 BKN 用的令牌，权限边界即该用户本人。
   *
   * 只作为 event 下发给沙箱，不用来给本次 HTTP 请求签名——打执行工厂的鉴权
   * 由 http 客户端统一处理（它持有当前有效令牌并负责刷新），手拼 Authorization
   * 会用上一个已经失效的快照，表现为 401 token is invalid。
   */
  token: string;
  /**
   * 当前知识网络 id。常规模式由 effectiveToolArgs 自动补进每次工具调用，
   * PTC 模式没有这层注入——不告诉模型它就会自己编一个，实测如此。
   */
  knId: string;
  /** 执行工厂前缀。http 客户端已带 /api 的 baseURL，这里不要再加。 */
  apiBase?: string;
};

export function buildPtcTools(options: PtcToolOptions): ToolSet {
  const { toolkit, bknContext, token, knId } = options;
  // http 客户端的 baseURL 已经是 /api，这里再拼一次会打到 /api/api/… 上去。
  const base = options.apiBase ?? AGENT_OPERATOR_API_PREFIX;

  return {
    run_code: tool({
      description:
        `${toolkit.digest}\n\n` +
        `## 当前知识网络\n\n` +
        `本次会话锁定在 \`kn_id = "${knId}"\`，直接用这个值，不要臆造，也不要先去列网络。\n`,
      inputSchema: jsonSchema({
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "要执行的 Python 代码。只有 print 的内容会返回。",
          },
          timeout: { type: "integer", description: "执行超时秒数", default: 60 },
        },
        required: ["code"],
      }),
      execute: async (input: unknown): Promise<string> => {
        const { code, timeout = 60 } = (input ?? {}) as { code?: string; timeout?: number };
        if (!code || !code.trim()) return "错误：code 为空。请给出要执行的 Python 代码。";

        const { data: result } = await http.post<ExecuteResponse>(
          `${base}/function/execute`,
          {
            code: wrapForSandbox(toolkit.stub, code),
            language: "python",
            timeout,
            // 凭据与会话上下文走 event 而非 env_vars：沙箱会话是池化复用的，
            // env 会把上一个调用方的值留在容器里，event 是每次调用的入参。
            event: { mcp: toolkit.sandbox_mcp_url, token, bkn: bknContext() ?? {} },
          },
          {
            headers: getAgentOperatorHeaders(),
            // 沙箱执行可能跑满 timeout；HTTP 侧要留够余量，否则连接先断，
            // 模型拿到的是网络错误而不是脚本的 traceback。
            timeout: (timeout + 30) * 1000,
            skipErrorToast: true,
          },
        );

        const stdout = (result.stdout ?? "").trim();
        if (result.exit_code === 0) {
          return stdout || "（脚本没有输出。只有 print 的内容会返回，记得打印结果。）";
        }

        // 失败时把 stderr 一并回传：traceback 里的服务端报文是模型自行修正参数
        // 的唯一依据，吞掉它就只能盲目重试。实测中模型据此改写脚本并跑通。
        const stderr = (result.stderr ?? result.error_message ?? "").trim();
        return [`执行失败（exit_code=${result.exit_code}）`, stdout, stderr]
          .filter(Boolean)
          .join("\n");
      },
    }),
  };
}
