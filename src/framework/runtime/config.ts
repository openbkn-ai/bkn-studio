import type { RuntimeConfig, RuntimeInput, TokenManager } from "@/framework/runtime/types";
import {
  getDevAccessToken,
  handleDevAuthFailure,
  shouldUseDevAuth,
} from "@/framework/auth/dev-auth";
import { refreshOAuthTokens, shouldUseOAuthGate } from "@/framework/auth/oauth";
import { clearStoredTokens } from "@/framework/auth/token-store";
import { defaultDevRuntimeUser } from "@/framework/runtime/dev-profile";

const storageTokenManager: TokenManager = {
  getAccessToken: () => getDevAccessToken(),
  refreshAccessToken: () => refreshOAuthTokens(),
  onAuthFailure: () => {
    handleDevAuthFailure();

    // Outside dev remote-debug mode the reload is not triggered above; force a
    // reload so the AuthGate drops to the sign-in screen.
    if (!shouldUseDevAuth() && shouldUseOAuthGate(getRuntimeConfig().mode)) {
      clearStoredTokens();
      window.location.reload();
    }
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
    primaryColor: "#1e3a8a",
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
    features: {
      ...defaultRuntimeConfig.features,
      ...runtimeInput.features,
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
