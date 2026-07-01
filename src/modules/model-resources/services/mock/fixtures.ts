/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { LlmModel } from "@/modules/model-resources/types/llm";
import type { ModelQuota, UserQuotaRecord } from "@/modules/model-resources/types/quota";
import type { ModelStatisticsOverview } from "@/modules/model-resources/types/statistics";
import type { SmallModel } from "@/modules/model-resources/types/small-model";

export const mockLlmModels: LlmModel[] = [
  {
    modelId: "llm-1",
    modelName: "Demo GPT",
    modelType: "llm",
    modelSeries: "openai",
    maxModelLen: 128,
    modelParameters: 7,
    default: true,
    quota: true,
    billingType: 1,
    inputTokens: 100000,
    outputTokens: 50000,
    inputsUsed: 12000,
    outputsUsed: 8000,
    inputsLeft: 88000,
    outputsLeft: 42000,
    createBy: "admin",
    createTime: "2025-01-01 10:00:00",
    updateBy: "admin",
    updateTime: "2025-01-02 10:00:00",
    modelConfig: {
      apiModel: "gpt-4o",
      apiUrl: "https://api.openai.com/v1/chat/completions",
      apiKey: "sk-demo",
    },
  },
  {
    modelId: "llm-2",
    modelName: "Demo Claude",
    modelType: "llm",
    modelSeries: "claude",
    maxModelLen: 200,
    modelParameters: 13,
    default: false,
    quota: false,
    createBy: "admin",
    createTime: "2025-01-03 10:00:00",
    updateBy: "admin",
    updateTime: "2025-01-04 10:00:00",
    modelConfig: {
      apiModel: "claude-3-5-sonnet",
      apiUrl: "https://api.anthropic.com/v1/messages",
    },
  },
];

export const mockSmallModels: SmallModel[] = [
  {
    modelId: "sm-1",
    modelName: "Demo Embedding",
    modelType: "embedding",
    adapter: false,
    embeddingDim: 1536,
    batchSize: 10,
    maxTokens: 8192,
    createBy: "admin",
    createTime: "2025-01-01 10:00:00",
    updateBy: "admin",
    updateTime: "2025-01-02 10:00:00",
    modelConfig: {
      apiModel: "text-embedding-3-small",
      apiUrl: "https://api.openai.com/v1/embeddings",
    },
    operations: ["modify", "delete", "authorize"],
    default: true,
  },
  {
    modelId: "sm-2",
    modelName: "Demo Reranker",
    modelType: "reranker",
    adapter: false,
    maxDocuments: 20,
    maxTokens: 4096,
    createBy: "admin",
    createTime: "2025-01-03 10:00:00",
    updateBy: "operator",
    updateTime: "2025-01-04 10:00:00",
    modelConfig: {
      apiModel: "bge-reranker",
      apiUrl: "http://127.0.0.1:8343/v1/rerank",
    },
    operations: ["modify", "delete"],
  },
];

export const mockModelQuotas: ModelQuota[] = [
  {
    id: "quota-1",
    confId: "quota-1",
    modelId: "llm-1",
    modelName: "Demo GPT",
    modelSeries: "gpt",
    model: "gpt-4o",
    inputTokens: 100,
    outputTokens: 50,
    billingType: 1,
    numType: [2, 2],
    priceType: ["thousand", "thousand"],
    referPriceIn: 0.01,
    referPriceOut: 0.02,
    currencyType: 1,
    totalPrice: 1500,
    updateTime: "2025-01-05 10:00:00",
  },
  {
    id: "quota-2",
    confId: "quota-2",
    modelId: "llm-2",
    modelName: "Demo Claude",
    modelSeries: "claude",
    model: "claude-3-5-sonnet",
    inputTokens: -1,
    outputTokens: -1,
    billingType: -1,
    numType: [1, 1],
    priceType: ["thousand", "thousand"],
    referPriceIn: -1,
    referPriceOut: -1,
    currencyType: 0,
    updateTime: "2025-01-04 10:00:00",
  },
];

export const mockUserQuotas: UserQuotaRecord[] = [
  {
    userQuotaId: "uq-1",
    userId: "user-1",
    userName: "Alice",
    inputTokens: 20,
    outputTokens: 10,
    numType: [2, 2],
    modelQuotaId: "quota-1",
  },
];

export const mockAssignableUsers = [
  { userId: "user-1", userName: "Alice" },
  { userId: "user-2", userName: "Bob" },
  { userId: "user-3", userName: "Carol" },
];

export const mockLlmMonitorData = {
  averageFirstTokenTime: [
    { time: "06/08 10:00", value: 0.32 },
    { time: "06/09 10:00", value: 0.28 },
    { time: "06/10 10:00", value: 0.25 },
  ],
  outputTokenSpeed: [
    { time: "06/08 10:00", value: 42 },
    { time: "06/09 10:00", value: 45 },
    { time: "06/10 10:00", value: 48 },
  ],
  totalTokenSpeed: [
    { time: "06/08 10:00", value: 120 },
    { time: "06/09 10:00", value: 132 },
    { time: "06/10 10:00", value: 140 },
  ],
};

export const mockModelStatisticsOverview: ModelStatisticsOverview = {
  summary: {
    totalUsage: 1280,
    errorRate: 0.0025,
    avgResponseTime: 1.24,
    totalTokens: 560000,
    inputTokens: 320000,
    outputTokens: 240000,
  },
  trends: [
    {
      date: "2025-06-07",
      inputTokens: 9800,
      outputTokens: 7200,
      avgTotalTime: 1.05,
      avgFirstTime: 0.28,
      avgRate: 38,
    },
    {
      date: "2025-06-08",
      inputTokens: 12000,
      outputTokens: 8000,
      avgTotalTime: 1.1,
      avgFirstTime: 0.3,
      avgRate: 42,
    },
    {
      date: "2025-06-09",
      inputTokens: 15000,
      outputTokens: 9000,
      avgTotalTime: 1.2,
      avgFirstTime: 0.35,
      avgRate: 45,
    },
    {
      date: "2025-06-10",
      inputTokens: 13200,
      outputTokens: 8600,
      avgTotalTime: 1.18,
      avgFirstTime: 0.33,
      avgRate: 44,
    },
  ],
  qpsData: [
    { date: "2025-06-09 08:00:00", avgQps: 2.9 },
    { date: "2025-06-09 10:00:00", avgQps: 3.2 },
    { date: "2025-06-09 12:00:00", avgQps: 3.8 },
    { date: "2025-06-09 14:00:00", avgQps: 3.5 },
  ],
};
