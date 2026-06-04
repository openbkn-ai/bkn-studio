import type { RuntimeConfig, RuntimeInput, TokenManager } from "@/framework/runtime/types";

const storageTokenManager: TokenManager = {
  getAccessToken: () => window.sessionStorage.getItem("bkn_access_token"),
  refreshAccessToken: () => Promise.resolve(null),
  onAuthFailure: () => {
    window.sessionStorage.removeItem("bkn_access_token");
  },
};

const rawApiBaseUrl: unknown = import.meta.env.VITE_API_BASE_URL;
const envApiBaseUrl =
  typeof rawApiBaseUrl === "string" && rawApiBaseUrl.trim().length > 0
    ? rawApiBaseUrl.trim()
    : "/api";

const defaultRuntimeConfig: RuntimeConfig = {
  apiBaseUrl: envApiBaseUrl,
  auth: {
    tokenManager: storageTokenManager,
  },
  currentUser: {
    businessDomainId: null,
    id: "local-admin",
    name: "Local Admin",
    permissions: [
      "starter:create",
      "starter:edit",
      "starter:toggle",
      "data-connect:create",
      "data-connect:edit",
      "data-connect:delete",
      "data-connect:test",
      "data-connect:toggle",
      "data-connect-scan:create",
      "data-connect-scan:edit",
      "data-connect-scan:delete",
      "data-connect-scan:toggle",
      "data-connect-scan:trigger",
    ],
    roles: ["admin"],
  },
  locale: "zh-CN",
  mode: "standalone",
  router: {
    basename: "/",
  },
  theme: {
    borderRadius: 12,
    primaryColor: "#0d7a6f",
  },
};

let runtimeConfig = defaultRuntimeConfig;

export function createRuntimeConfig(runtimeInput: RuntimeInput = {}): RuntimeConfig {
  return {
    ...defaultRuntimeConfig,
    ...runtimeInput,
    auth: {
      tokenManager:
        runtimeInput.auth?.tokenManager ?? defaultRuntimeConfig.auth.tokenManager,
    },
    currentUser: {
      ...defaultRuntimeConfig.currentUser,
      ...runtimeInput.currentUser,
      permissions:
        runtimeInput.currentUser?.permissions ??
        defaultRuntimeConfig.currentUser.permissions,
      roles:
        runtimeInput.currentUser?.roles ?? defaultRuntimeConfig.currentUser.roles,
    },
    router: {
      ...defaultRuntimeConfig.router,
      ...runtimeInput.router,
    },
    theme: {
      ...defaultRuntimeConfig.theme,
      ...runtimeInput.theme,
    },
  };
}

export function setRuntimeConfig(config: RuntimeConfig) {
  runtimeConfig = config;
}

export function getRuntimeConfig() {
  return runtimeConfig;
}

export function readWindowRuntimeInput(): RuntimeInput {
  return window.__BKN_STUDIO_RUNTIME__ ?? {};
}
