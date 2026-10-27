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

let refreshPromise: Promise<string | null> | null = null;
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

async function refreshAccessToken() {
  const runtimeConfig = getRuntimeConfig();

  if (!refreshPromise) {
    refreshPromise = runtimeConfig.auth.tokenManager.refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
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
  (response) => response,
  async (error) => {
    const runtimeConfig = getRuntimeConfig();
    const axiosError = axios.isAxiosError(error) ? error : null;
    const config = axiosError?.config as RetryableRequestConfig | undefined;
    const status = axiosError?.response?.status;

    if (status === 401 && !config?.skipAuthRefresh) {
      if (config && !config._retry) {
        config._retry = true;

        try {
          const refreshedToken = await refreshAccessToken();

          if (refreshedToken) {
            config.headers.set("Authorization", `Bearer ${refreshedToken}`);
            return http(config);
          }
        } catch {
          // A revoked refresh token ends the session below.
        }
        runtimeConfig.auth.tokenManager.onAuthFailure?.();
      } else if (config && (await isSessionRejected(config))) {
        runtimeConfig.auth.tokenManager.onAuthFailure?.();
      }
    }

    await decodeBlobErrorBody(error);

    notifyRequestError(error, config);

    return Promise.reject(error instanceof Error ? error : new Error("HTTP request failed."));
  },
);
