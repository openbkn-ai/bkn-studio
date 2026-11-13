/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { getRuntimeConfig } from "@/framework/runtime/config";
import type { TokenManager } from "@/framework/runtime/types";

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _errorNotified?: boolean;
  _retry?: boolean;
  skipAuthRefresh?: boolean;
  skipErrorToast?: boolean;
};

type RequestErrorHandler = ((message: string) => void) | null;

export const http = axios.create({
  timeout: 30000,
});

// A stalled token endpoint must not leave every request waiting on it: past
// this bound the refresh counts as failed and the session check takes over.
export const AUTH_REFRESH_TIMEOUT_MS = 10_000;

let refreshPromise: Promise<string | null> | null = null;
// The token manager whose session was already ended. Concurrent 401s then end
// it once instead of each one reloading the page again.
let endedSessionFor: TokenManager | null = null;
let requestErrorHandler: RequestErrorHandler = null;

function notifyRequestError(error: unknown, config?: RetryableRequestConfig) {
  if (config?.skipErrorToast || config?._errorNotified) {
    return;
  }

  if (config) {
    config._errorNotified = true;
  }

  requestErrorHandler?.(extractRequestErrorMessage(error));
}

/**
 * A failed download answers with the error body typed as a Blob, which every
 * message extractor reads as an empty object. Decoding it back into JSON before
 * the toast fires is what keeps a rejected export from reporting a generic
 * failure while the backend explained itself.
 */
async function decodeBlobErrorBody(error: unknown) {
  if (!axios.isAxiosError(error) || !error.response) {
    return;
  }

  const data: unknown = error.response.data;

  if (typeof Blob === "undefined" || !(data instanceof Blob)) {
    return;
  }

  try {
    const text = await data.text();
    const parsed: unknown = text ? JSON.parse(text) : undefined;
    error.response.data = parsed;
  } catch {
    // A non-JSON body (an HTML gateway page, a truncated stream) carries nothing
    // the extractor could use, so the generic message stands.
  }
}

async function refreshAccessToken(tokenManager: TokenManager) {
  if (!refreshPromise) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error("Token refresh timed out."));
      }, AUTH_REFRESH_TIMEOUT_MS);
    });
    refreshPromise = Promise.race([tokenManager.refreshAccessToken(), timeout]).finally(() => {
      clearTimeout(timer);
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

function endSession(tokenManager: TokenManager) {
  if (endedSessionFor === tokenManager) {
    return;
  }
  endedSessionFor = tokenManager;
  tokenManager.onAuthFailure?.();
}

async function isSessionRejected(config: RetryableRequestConfig): Promise<boolean> {
  if (config.url === "/safe/v1/me") {
    return true;
  }

  // A business endpoint can return 401 even with a valid refreshed token.
  // Confirm the session through the account endpoint before clearing it.
  try {
    const response = await axios.get("/safe/v1/me", {
      adapter: config.adapter,
      baseURL: getRuntimeConfig().apiBaseUrl,
      headers: { Authorization: config.headers.get("Authorization") },
      timeout: 3000,
    });
    return response.status === 401;
  } catch (error) {
    return axios.isAxiosError(error) && error.response?.status === 401;
  }
}

export function setRequestErrorHandler(handler: RequestErrorHandler) {
  requestErrorHandler = handler;
}

http.interceptors.request.use((config) => {
  const runtimeConfig = getRuntimeConfig();
  const token = runtimeConfig.auth.tokenManager.getAccessToken();

  config.baseURL = runtimeConfig.apiBaseUrl;
  config.headers.set("Accept-Language", runtimeConfig.locale);

  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

http.interceptors.response.use(
  (response) => {
    // A request that gets through again means the session is live (a host may
    // renew it without a reload), so a later expiry must end it again.
    endedSessionFor = null;
    return response;
  },
  async (error) => {
    const { tokenManager } = getRuntimeConfig().auth;
    const axiosError = axios.isAxiosError(error) ? error : null;
    const config = axiosError?.config as RetryableRequestConfig | undefined;
    const status = axiosError?.response?.status;

    // Once the session has been ended, further 401s neither refresh nor end it
    // again; the redirect to sign-in is already under way.
    if (status === 401 && !config?.skipAuthRefresh && endedSessionFor !== tokenManager) {
      if (config && !config._retry) {
        config._retry = true;

        try {
          const refreshedToken = await refreshAccessToken(tokenManager);

          if (refreshedToken) {
            config.headers.set("Authorization", `Bearer ${refreshedToken}`);
            return http(config);
          }
        } catch {
          // A refresh failure alone does not establish that the session has expired.
        }
        if (await isSessionRejected(config)) {
          endSession(tokenManager);
        }
      } else if (config && (await isSessionRejected(config))) {
        endSession(tokenManager);
      }
    }

    await decodeBlobErrorBody(error);

    notifyRequestError(error, config);

    return Promise.reject(error instanceof Error ? error : new Error("HTTP request failed."));
  },
);
