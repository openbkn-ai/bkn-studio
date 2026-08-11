/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

type TraceCallback<T> = () => T;

type BrowserTracingChannel = {
  hasSubscribers: false;
  tracePromise: <T>(callback: TraceCallback<T>) => T;
};

export function tracingChannel(): BrowserTracingChannel {
  return {
    hasSubscribers: false,
    tracePromise: (callback) => callback(),
  };
}
