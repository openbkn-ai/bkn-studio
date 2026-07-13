/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";

/** 当前用户资料（GET /api/safe/v1/me）。name/email/telephone 可自助改，其余只读。 */
export type MyProfile = {
  id: string;
  account: string;
  name: string;
  email: string;
  telephone: string;
  accountType: string;
  enabled: boolean;
  departments: string[];
  roles: string[];
  updatedAt: string;
};

/** 自助可写字段（PUT /api/safe/v1/me，部分更新）。 */
export type ProfileUpdatePayload = {
  name?: string;
  email?: string;
  telephone?: string;
};

const useMock = import.meta.env.VITE_USE_MOCK !== "false";

type BackendMe = {
  id: string;
  account: string;
  name: string;
  email?: string;
  telephone?: string;
  account_type?: string;
  enabled?: boolean;
  departments?: string[];
  roles?: string[];
  updated_at?: string;
};

let mockProfile: MyProfile = {
  id: "local-admin",
  account: "local-admin",
  name: "Local Admin",
  email: "admin@bkn.local",
  telephone: "",
  accountType: "user",
  enabled: true,
  departments: ["bkn-platform"],
  roles: ["super_admin"],
  updatedAt: "2026-01-01T00:00:00Z",
};

function mapMe(data: BackendMe): MyProfile {
  return {
    id: data.id,
    account: data.account,
    name: data.name,
    email: data.email ?? "",
    telephone: data.telephone ?? "",
    accountType: data.account_type ?? "",
    enabled: data.enabled ?? true,
    departments: data.departments ?? [],
    roles: data.roles ?? [],
    updatedAt: data.updated_at ?? "",
  };
}

export async function getMyProfile(): Promise<MyProfile> {
  if (useMock) {
    return mockProfile;
  }
  const response = await http.get<BackendMe>("/safe/v1/me");
  return mapMe(response.data);
}

/**
 * 自助改资料（PUT /api/safe/v1/me，部分更新）。
 * 后端：无可更新字段 / 校验不过 → 400；无 token → 401；subject 无用户 → 404。
 * email 为裸地址（不含显示名），空串清空；telephone ≤64；name 非空 ≤255。
 */
export async function updateMyProfile(payload: ProfileUpdatePayload): Promise<MyProfile> {
  if (useMock) {
    mockProfile = {
      ...mockProfile,
      ...payload,
      updatedAt: new Date().toISOString(),
    };
    return mockProfile;
  }
  // PUT 的响应体形态不保证（可能 204 / 只回改动字段），不直接用——改后重新 GET 拿权威完整资料。
  await http.put("/safe/v1/me", payload, { skipErrorToast: true });
  return getMyProfile();
}

/**
 * 自助改密码（POST /api/safe/v1/auth/change-password）。
 * 后端：new == old → 400；账号/旧密码错 → 401；成功 204。强度规则后端暂不校验。
 */
export async function changePassword(
  account: string,
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  if (useMock) {
    if (newPassword === oldPassword) {
      throw new Error("new password must differ from current");
    }
    return;
  }
  await http.post(
    "/safe/v1/auth/change-password",
    {
      account,
      old_password: oldPassword,
      new_password: newPassword,
    },
    { skipErrorToast: true },
  );
}
