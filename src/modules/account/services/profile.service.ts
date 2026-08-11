/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";

/** Current user profile from GET /api/safe/v1/me. Users may update name, email, and telephone; all other fields are read-only. */
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

/** Self-service writable fields for partial PUT /api/safe/v1/me updates. */
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
 * Self-service profile update through partial PUT /api/safe/v1/me. The backend returns 400 for
 * no writable fields or validation failure, 401 without a token, and 404 when the subject has no user.
 * email is a bare address, empty strings clear fields, telephone is at most 64 characters, and name is nonempty and at most 255.
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
  // PUT response shape is not guaranteed; it may be 204 or return only changed fields, so GET again for the authoritative complete profile.
  await http.put("/safe/v1/me", payload, { skipErrorToast: true });
  return getMyProfile();
}

/**
 * Self-service password change through POST /api/safe/v1/auth/change-password. The backend returns
 * 400 when new equals old, 401 for an invalid account or old password, and 204 on success; it currently does not validate strength.
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
