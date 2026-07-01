/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type ModelQuota = {
  id: string;
  confId: string;
  modelId: string;
  modelName: string;
  modelSeries?: string;
  model: string;
  inputTokens: number;
  outputTokens?: number;
  billingType: number;
  numType: number[];
  priceType: string[];
  referPriceIn?: number;
  referPriceOut?: number;
  currencyType?: number;
  totalPrice?: number;
  updateTime?: string;
};

export type ModelQuotaListQuery = {
  page: number;
  size: number;
  order?: string;
  rule?: string;
  name?: string;
  apiModel?: string;
};

export type ModelQuotaListResult = {
  items: ModelQuota[];
  total: number;
  modelOptions: string[];
};

export type ModelQuotaDetail = {
  confId: string;
  modelId: string;
  modelName: string;
  model: string;
  billingType: number;
  inputTokens: number;
  outputTokens: number;
  referPriceIn: number;
  referPriceOut: number;
  currencyType: number;
  numType: number[];
  priceType: string[];
};

export type ModelQuotaSavePayload = {
  modelId: string;
  billingType: number;
  currencyType: number;
  inputTokens: number;
  outputTokens?: number;
  referPriceIn: number;
  referPriceOut?: number;
  numType: number[];
  priceType: string[];
};

export type UserQuotaRecord = {
  userQuotaId?: string;
  userId: string;
  userName: string;
  inputTokens?: number;
  outputTokens?: number;
  inputsLeft?: number;
  outputsLeft?: number;
  numType: number[];
  modelQuotaId: string;
};

export type UserQuotaListResult = {
  items: UserQuotaRecord[];
  inputTokensRemain: number;
  outputTokensRemain: number;
};

export type UserQuotaSaveItem = {
  userId: string;
  userName: string;
  modelQuotaId: string;
  inputTokens: number;
  outputTokens?: number;
  numType: number[];
};
