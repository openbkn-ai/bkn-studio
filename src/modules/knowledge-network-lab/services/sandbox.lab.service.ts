/**
 * 领域知识网络「检索沙盒 / 接口调试」服务（实验版）。
 *
 * 对接真实检索接口：ontology-query 的指标试算
 *   POST /ontology-query/v1/knowledge-networks/{networkId}/metrics/{metricId}/data
 * 复用 `@/modules/knowledge-network` 的 metric 服务（内置 mock/real 切换）。
 * 这是当前后端真实可调用的查询入口，沙盒据此构造请求、发送并展示请求 / 响应。
 */

import {
  listKnowledgeNetworkMetrics,
  queryKnowledgeNetworkMetricData,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import type {
  KnowledgeNetworkMetricRecord,
  MetricDataQueryParams,
  MetricDataQueryResult,
} from "@/modules/knowledge-network/types/knowledge-network";

export type SandboxRequest = {
  method: "POST";
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
};

export type SandboxRunResult =
  | { ok: true; durationMs: number; result: MetricDataQueryResult }
  | { ok: false; error: string };

/** 列出该网络的指标（沙盒可试算的对象）。 */
export async function listSandboxMetrics(
  networkId: string,
): Promise<KnowledgeNetworkMetricRecord[]> {
  return listKnowledgeNetworkMetrics(networkId);
}

/** 构造指标试算的 HTTP 请求描述（请求面板实时预览即用它）。 */
export function buildMetricQueryRequest(
  networkId: string,
  metricId: string,
  params: MetricDataQueryParams,
): SandboxRequest {
  return {
    method: "POST",
    url: `/ontology-query/v1/knowledge-networks/${networkId}/metrics/${metricId}/data`,
    headers: { "Content-Type": "application/json" },
    body: {
      mode: params.mode,
      time_range: params.timeRange,
      limit: params.limit,
      fill_null: params.fillNull,
    },
  };
}

/** 发送指标试算请求并返回结果（真实后端，失败时返回可读错误）。 */
export async function runMetricQuery(
  networkId: string,
  metricId: string,
  params: MetricDataQueryParams,
): Promise<SandboxRunResult> {
  try {
    const result = await queryKnowledgeNetworkMetricData(networkId, metricId, params);
    return { ok: true, durationMs: result.durationMs ?? 0, result };
  } catch (error) {
    return { ok: false, error: extractRequestErrorMessage(error) };
  }
}
