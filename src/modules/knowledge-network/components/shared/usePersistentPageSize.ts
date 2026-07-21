/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const STORAGE_PREFIX = "bkn-knowledge-network-list-page-size:";

export function readPositiveInteger(value: string | null, fallback: number) {
  const next = Number(value);
  return Number.isInteger(next) && next > 0 ? next : fallback;
}

export function readStoredPageSize(scope: string, fallback: number) {
  try {
    return readPositiveInteger(localStorage.getItem(`${STORAGE_PREFIX}${scope}`), fallback);
  } catch {
    return fallback;
  }
}

export function writeStoredPageSize(scope: string, pageSize: number) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${scope}`, String(pageSize));
  } catch {
    // Ignore storage failures so pagination remains usable in restricted browsers.
  }
}

export function usePersistentPageSize(scope: string, fallback = 10) {
  const [searchParams, setSearchParams] = useSearchParams();

  const readPageSize = useCallback(() => {
    const pageSizeFromUrl = searchParams.get("pageSize");
    if (pageSizeFromUrl) {
      return readPositiveInteger(pageSizeFromUrl, fallback);
    }

    return readStoredPageSize(scope, fallback);
  }, [fallback, scope, searchParams]);

  const [pageSize, setPageSizeState] = useState(readPageSize);

  useEffect(() => {
    const nextPageSize = readPageSize();
    setPageSizeState((current) => (current === nextPageSize ? current : nextPageSize));

    if (searchParams.has("pageSize")) {
      writeStoredPageSize(scope, nextPageSize);
    }
  }, [readPageSize, scope, searchParams]);

  const setPageSize = useCallback(
    (nextPageSize: number) => {
      const normalizedPageSize = Number.isInteger(nextPageSize) && nextPageSize > 0
        ? nextPageSize
        : fallback;
      const nextParams = new URLSearchParams(searchParams);

      setPageSizeState(normalizedPageSize);
      writeStoredPageSize(scope, normalizedPageSize);

      if (normalizedPageSize === fallback) {
        nextParams.delete("pageSize");
      } else {
        nextParams.set("pageSize", String(normalizedPageSize));
      }

      setSearchParams(nextParams, { replace: true });
    },
    [fallback, scope, searchParams, setSearchParams],
  );

  return [pageSize, setPageSize] as const;
}
