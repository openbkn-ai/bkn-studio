import type { RuntimeConfig, RuntimeInput, TokenManager } from "@/framework/runtime/types";
import {
  getDevAccessToken,
  handleDevAuthFailure,
} from "@/framework/auth/dev-auth";
import { defaultDevRuntimeUser } from "@/framework/runtime/dev-profile";

const storageTokenManager: TokenManager = {
  getAccessToken: () => getDevAccessToken(),
  refreshAccessToken: () => Promise.resolve(null),
  onAuthFailure: () => {
    handleDevAuthFailure();
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
  currentUser: defaultDevRuntimeUser,
  locale: "zh-CN",
  mode: "standalone",
  router: {
    basename: "/",
  },
  theme: {
    borderRadius: 12,
    primaryColor: "#126EE3",
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
