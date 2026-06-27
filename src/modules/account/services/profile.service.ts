import { http } from "@/framework/request/http";

/** 当前用户资料（GET /api/safe/v1/me，只读）。 */
export type MyProfile = {
  id: string;
  account: string;
  name: string;
  email: string;
  accountType: string;
  departments: string[];
  roles: string[];
};

const useMock = import.meta.env.VITE_USE_MOCK !== "false";

type BackendMe = {
  id: string;
  account: string;
  name: string;
  email?: string;
  account_type?: string;
  departments?: string[];
  roles?: string[];
};

export async function getMyProfile(): Promise<MyProfile> {
  if (useMock) {
    return {
      id: "local-admin",
      account: "local-admin",
      name: "Local Admin",
      email: "admin@bkn.local",
      accountType: "user",
      departments: ["bkn-platform"],
      roles: ["super_admin"],
    };
  }
  const response = await http.get<BackendMe>("/safe/v1/me");
  const data = response.data;
  return {
    id: data.id,
    account: data.account,
    name: data.name,
    email: data.email ?? "",
    accountType: data.account_type ?? "",
    departments: data.departments ?? [],
    roles: data.roles ?? [],
  };
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
  await http.post("/safe/v1/auth/change-password", {
    account,
    old_password: oldPassword,
    new_password: newPassword,
  });
}
