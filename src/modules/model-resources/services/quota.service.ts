/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import {
  mockAssignableUsers,
  mockModelQuotas,
  mockUserQuotas,
} from "@/modules/model-resources/services/mock/fixtures";
import type {
  ModelQuota,
  ModelQuotaDetail,
  ModelQuotaListQuery,
  ModelQuotaListResult,
  ModelQuotaSavePayload,
  UserQuotaListResult,
  UserQuotaRecord,
  UserQuotaSaveItem,
} from "@/modules/model-resources/types/quota";
import { listUsersPage } from "@/modules/system-admin/services/admin.service";

const API_PREFIX = "/mf-model-manager/v1";
const useMock = import.meta.env.VITE_USE_MOCK !== "false";

type BackendModelQuota = {
  conf_id?: string;
  id?: string;
  model_id: string;
  model_name: string;
  model_series?: string;
  model: string;
  input_tokens: number;
  output_tokens?: number;
  billing_type: number;
  num_type: number[];
  referprice_in?: number;
  referprice_out?: number;
  price_type?: string[];
  currency_type?: number;
  total_price?: number;
  update_time?: string;
};

type BackendModelQuotaListResponse = {
  total?: number;
  res?: BackendModelQuota[];
  model_list?: string[];
};

type BackendUserQuota = {
  user_quota_id?: string;
  user_id: string;
  user_name: string;
  input_tokens?: number;
  output_tokens?: number;
  inputs_left?: number;
  outputs_left?: number;
  num_type?: number[];
  model_quota_id: string;
};

type BackendUserQuotaListResponse = {
  res?: BackendUserQuota[];
  input_tokens_remain?: number;
  output_tokens_remain?: number;
};

type AssignableUser = {
  userId: string;
  userName: string;
};

function mapModelQuota(item: BackendModelQuota): ModelQuota {
  const confId = item.conf_id ?? item.id ?? item.model_id;

  return {
    id: confId,
    confId,
    modelId: item.model_id,
    modelName: item.model_name,
    modelSeries: item.model_series,
    model: item.model,
    inputTokens: item.input_tokens,
    outputTokens: item.output_tokens,
    billingType: item.billing_type,
    numType: item.num_type ?? [1, 1],
    referPriceIn: item.referprice_in,
    referPriceOut: item.referprice_out,
    priceType: item.price_type ?? ["thousand", "thousand"],
    currencyType: item.currency_type,
    totalPrice: item.total_price,
    updateTime: item.update_time,
  };
}

function mapUserQuota(item: BackendUserQuota): UserQuotaRecord {
  return {
    userQuotaId: item.user_quota_id,
    userId: item.user_id,
    userName: item.user_name,
    inputTokens: item.input_tokens,
    outputTokens: item.output_tokens,
    inputsLeft: item.inputs_left,
    outputsLeft: item.outputs_left,
    numType: item.num_type ?? [1, 1],
    modelQuotaId: item.model_quota_id,
  };
}

function mapSavePayload(payload: ModelQuotaSavePayload) {
  return {
    model_id: payload.modelId,
    billing_type: payload.billingType,
    currency_type: payload.currencyType,
    input_tokens: payload.inputTokens,
    output_tokens: payload.outputTokens,
    referprice_in: payload.referPriceIn,
    referprice_out: payload.referPriceOut,
    num_type: payload.numType,
    price_type: payload.priceType,
  };
}

function filterMockModelQuotas(query: ModelQuotaListQuery): ModelQuotaListResult {
  const keyword = query.name?.trim().toLowerCase();
  let items = [...mockModelQuotas];

  if (query.apiModel && query.apiModel !== "all") {
    items = items.filter((item) => item.model === query.apiModel);
  }

  if (keyword) {
    items = items.filter((item) => item.modelName.toLowerCase().includes(keyword));
  }

  const rule = query.rule ?? "update_time";
  const order = query.order ?? "desc";

  items.sort((left, right) => {
    if (rule === "model_name") {
      const compare = left.modelName.localeCompare(right.modelName);
      return order === "asc" ? compare : -compare;
    }

    if (rule === "total_price") {
      const compare = (left.totalPrice ?? 0) - (right.totalPrice ?? 0);
      return order === "asc" ? compare : -compare;
    }

    const leftTime = left.updateTime ?? "";
    const rightTime = right.updateTime ?? "";
    const compare = leftTime.localeCompare(rightTime);
    return order === "asc" ? compare : -compare;
  });

  const start = (query.page - 1) * query.size;

  return {
    items: items.slice(start, start + query.size),
    total: items.length,
    modelOptions: Array.from(new Set(mockModelQuotas.map((item) => item.model))),
  };
}

export async function listModelQuotas(
  query: ModelQuotaListQuery,
): Promise<ModelQuotaListResult> {
  if (useMock) {
    return filterMockModelQuotas(query);
  }

  const response = await http.get<BackendModelQuotaListResponse>(
    `${API_PREFIX}/model-quota/list`,
    {
      params: {
        page: query.page,
        size: query.size,
        order: query.order ?? "desc",
        rule: query.rule ?? "update_time",
        name: query.name ?? "",
        ...(query.apiModel && query.apiModel !== "all"
          ? { api_model: query.apiModel }
          : {}),
      },
    },
  );

  const payload = response.data;

  return {
    items: (payload.res ?? []).map(mapModelQuota),
    total: payload.total ?? 0,
    modelOptions: payload.model_list ?? [],
  };
}

export async function getModelQuotaDetail(confId: string): Promise<ModelQuotaDetail | null> {
  if (useMock) {
    const record = mockModelQuotas.find((item) => item.confId === confId);
    if (!record) {
      return null;
    }

    return {
      confId: record.confId,
      modelId: record.modelId,
      modelName: record.modelName,
      model: record.model,
      billingType: record.billingType,
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens ?? -1,
      referPriceIn: record.referPriceIn ?? -1,
      referPriceOut: record.referPriceOut ?? -1,
      currencyType: record.currencyType ?? 0,
      numType: record.numType,
      priceType: record.priceType,
    };
  }

  const response = await http.get<{ res?: BackendModelQuota }>(
    `${API_PREFIX}/model-quota/${confId}`,
  );
  const item = response.data?.res;

  if (!item) {
    return null;
  }

  const mapped = mapModelQuota(item);

  return {
    confId: mapped.confId,
    modelId: mapped.modelId,
    modelName: mapped.modelName,
    model: mapped.model,
    billingType: mapped.billingType,
    inputTokens: mapped.inputTokens,
    outputTokens: mapped.outputTokens ?? -1,
    referPriceIn: mapped.referPriceIn ?? -1,
    referPriceOut: mapped.referPriceOut ?? -1,
    currencyType: mapped.currencyType ?? 0,
    numType: mapped.numType,
    priceType: mapped.priceType,
  };
}

export async function createModelQuota(payload: ModelQuotaSavePayload): Promise<boolean> {
  if (useMock) {
    mockModelQuotas.push({
      id: `quota-${mockModelQuotas.length + 1}`,
      confId: `quota-${mockModelQuotas.length + 1}`,
      modelId: payload.modelId,
      modelName: "Mock Model",
      model: "gpt-4o",
      inputTokens: payload.inputTokens,
      outputTokens: payload.outputTokens,
      billingType: payload.billingType,
      numType: payload.numType,
      priceType: payload.priceType,
      referPriceIn: payload.referPriceIn,
      referPriceOut: payload.referPriceOut,
      currencyType: payload.currencyType,
      updateTime: new Date().toISOString().slice(0, 19).replace("T", " "),
    });
    return true;
  }

  const response = await http.post<{ res?: unknown }>(
    `${API_PREFIX}/model-quota`,
    mapSavePayload(payload),
  );

  return Boolean(response.data?.res);
}

export async function updateModelQuota(
  confId: string,
  payload: ModelQuotaSavePayload,
): Promise<boolean> {
  if (useMock) {
    const index = mockModelQuotas.findIndex((item) => item.confId === confId);
    if (index >= 0) {
      mockModelQuotas[index] = {
        ...mockModelQuotas[index],
        inputTokens: payload.inputTokens,
        outputTokens: payload.outputTokens,
        billingType: payload.billingType,
        numType: payload.numType,
        priceType: payload.priceType,
        referPriceIn: payload.referPriceIn,
        referPriceOut: payload.referPriceOut,
        currencyType: payload.currencyType,
        updateTime: new Date().toISOString().slice(0, 19).replace("T", " "),
      };
    }
    return true;
  }

  const response = await http.post<{ res?: unknown }>(
    `${API_PREFIX}/model-quota/${confId}`,
    mapSavePayload(payload),
  );

  return Boolean(response.data?.res);
}

export async function listUserQuotas(confId: string): Promise<UserQuotaListResult> {
  if (useMock) {
    const quota = mockModelQuotas.find((item) => item.confId === confId);
    const items = mockUserQuotas.filter((item) => item.modelQuotaId === confId);
    const inputRemain =
      (quota?.inputTokens ?? 0) -
      items.reduce((sum, item) => sum + (item.inputTokens ?? 0), 0);
    const outputRemain =
      (quota?.outputTokens ?? 0) -
      items.reduce((sum, item) => sum + (item.outputTokens ?? 0), 0);

    return {
      items,
      inputTokensRemain: Math.max(inputRemain, 0),
      outputTokensRemain: Math.max(outputRemain, 0),
    };
  }

  const response = await http.get<BackendUserQuotaListResponse>(
    `${API_PREFIX}/user-quota/list`,
    {
      params: {
        conf_id: confId,
        page: 1,
        size: 1000,
        rule: "update_time",
        order: "desc",
      },
    },
  );
  const payload = response.data;

  return {
    items: (payload.res ?? []).map(mapUserQuota),
    inputTokensRemain: payload.input_tokens_remain ?? 0,
    outputTokensRemain: payload.output_tokens_remain ?? 0,
  };
}

export async function saveUserQuotas(items: UserQuotaSaveItem[]): Promise<boolean> {
  if (items.length === 0) {
    return true;
  }

  if (useMock) {
    items.forEach((item) => {
      const existingIndex = mockUserQuotas.findIndex(
        (record) =>
          record.modelQuotaId === item.modelQuotaId && record.userId === item.userId,
      );

      const nextRecord: UserQuotaRecord = {
        userQuotaId: existingIndex >= 0 ? mockUserQuotas[existingIndex].userQuotaId : `uq-${mockUserQuotas.length + 1}`,
        userId: item.userId,
        userName: item.userName,
        inputTokens: item.inputTokens,
        outputTokens: item.outputTokens,
        numType: item.numType,
        modelQuotaId: item.modelQuotaId,
      };

      if (existingIndex >= 0) {
        mockUserQuotas[existingIndex] = nextRecord;
      } else {
        mockUserQuotas.push(nextRecord);
      }
    });
    return true;
  }

  const response = await http.post<{ res?: unknown }>(`${API_PREFIX}/user-quota`, {
    list: items.map((item) => ({
      user_id: item.userId,
      user_name: item.userName,
      model_quota_id: item.modelQuotaId,
      input_tokens: item.inputTokens,
      output_tokens: item.outputTokens,
      num_type: item.numType,
    })),
  });

  return Boolean(response.data?.res);
}

export async function deleteUserQuotas(userQuotaIds: string[]): Promise<boolean> {
  if (useMock) {
    userQuotaIds.forEach((id) => {
      const index = mockUserQuotas.findIndex((item) => item.userQuotaId === id);
      if (index >= 0) {
        mockUserQuotas.splice(index, 1);
      }
    });
    return true;
  }

  const response = await http.post<{ res?: unknown }>(`${API_PREFIX}/user-quota/delete`, {
    conf_id_list: userQuotaIds,
  });

  return Boolean(response.data?.res);
}

export async function searchAssignableUsers(keyword?: string): Promise<AssignableUser[]> {
  if (useMock) {
    const normalized = keyword?.trim().toLowerCase();
    return mockAssignableUsers.filter((user) => {
      if (!normalized) {
        return true;
      }

      return user.userName.toLowerCase().includes(normalized);
    });
  }

  try {
    const result = await listUsersPage(
      { search: keyword, offset: 0, limit: 50 },
      { skipErrorToast: true },
    );

    return result.users.map((item) => ({
      userId: item.id,
      userName: item.name || item.account,
    }));
  } catch {
    return [];
  }
}
