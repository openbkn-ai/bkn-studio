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
  skipErrorToast?: boolean;
};

type RequestErrorHandler = ((message: string) => void) | null;

export const http = axios.create({
  timeout: import.meta.env.DEV ? 30000 : 15000,
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

async function refreshAccessToken() {
  const runtimeConfig = getRuntimeConfig();

  if (!refreshPromise) {
    refreshPromise = runtimeConfig.auth.tokenManager
      .refreshAccessToken()
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
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

    if (status === 401 && config && !config._retry) {
      config._retry = true;

      try {
        const refreshedToken = await refreshAccessToken();

        if (refreshedToken) {
          config.headers.set("Authorization", `Bearer ${refreshedToken}`);
          return http(config);
        }
      } catch {
        runtimeConfig.auth.tokenManager.onAuthFailure?.();
      }

      runtimeConfig.auth.tokenManager.onAuthFailure?.();
    }

    notifyRequestError(error, config);

    return Promise.reject(
      error instanceof Error ? error : new Error("HTTP request failed."),
    );
  },
);
