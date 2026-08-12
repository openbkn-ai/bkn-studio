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

import type { McpToolDef } from "@/modules/knowledge-network/services/context-loader.service";

import { AGENT_OPERATOR_API_PREFIX } from "../shared/agent-operator-client";
import stubSource from "./generated/_tools.py?raw";
import { renderToolDigest } from "./tool-digest";

/**
 * 沙箱回访 context-loader 用的 MCP 端点。
 *
 * 必须是集群内地址：浏览器侧的 base 经网关，沙箱走不到；而沙箱与 context-loader
 * 同在集群内，直接用 service 名。尾斜杠不能省——缺斜杠时服务端 307 跳转，而
 * 沙箱侧用的是 urllib，它不对 POST 跟随重定向。
 */
const DEFAULT_SANDBOX_MCP_URL = "http://agent-retrieval:30779/api/agent-retrieval/v1/mcp/";

/** 沙箱按 AWS Lambda 规范执行，入口必须是单参数的 handler(event)。 */
function wrapForSandbox(code: string): string {
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
  /**
   * 运行时的 MCP 工具清单，用于渲染 run_code 的工具说明。
   * 与常规模式同一份来源，工具增减或参数变更会自动反映到说明里。
   */
  mcpTools: McpToolDef[];
  /** 本轮的会话生命周期上下文，来源与常规模式一致。 */
  bknContext: () => Record<string, unknown> | undefined;
  /** 最终用户令牌：沙箱以调用者身份访问 BKN，权限边界即该用户本人。 */
  token: string;
  /** 网关前缀，浏览器经它打执行工厂。 */
  apiBase?: string;
  sandboxMcpUrl?: string;
  headers?: Record<string, string>;
};

export function buildPtcTools(options: PtcToolOptions): ToolSet {
  const { mcpTools, bknContext, token, headers = {} } = options;
  const base = options.apiBase ?? `/api${AGENT_OPERATOR_API_PREFIX}`;
  const mcpUrl = options.sandboxMcpUrl ?? DEFAULT_SANDBOX_MCP_URL;

  return {
    run_code: tool({
      description: renderToolDigest(mcpTools),
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

        const response = await fetch(`${base}/function/execute`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...headers,
          },
          body: JSON.stringify({
            code: wrapForSandbox(code),
            language: "python",
            timeout,
            // 凭据与会话上下文走 event 而非 env_vars：沙箱会话是池化复用的，
            // env 会把上一个调用方的值留在容器里，event 是每次调用的入参。
            event: { mcp: mcpUrl, token, bkn: bknContext() ?? {} },
          }),
        });

        if (!response.ok) {
          const detail = (await response.text()).slice(0, 500);
          return `沙箱执行请求失败（HTTP ${response.status}）：${detail}`;
        }

        const result = (await response.json()) as ExecuteResponse;
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
