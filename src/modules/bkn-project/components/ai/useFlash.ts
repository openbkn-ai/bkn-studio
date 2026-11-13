/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useCallback, useEffect, useState } from "react";

/** How long an item changed from Ask AI stays marked on the page. */
export const FLASH_MS = 2400;

/** The items just changed, by id, marked for a moment; and marks more. */
export function useFlash(): [ReadonlySet<string>, (ids: string[]) => void] {
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    if (!ids.size) {
      return undefined;
    }
    const timer = window.setTimeout(() => setIds(new Set()), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [ids]);
  const mark = useCallback((next: string[]) => {
    if (next.length) {
      setIds(new Set(next));
    }
  }, []);
  return [ids, mark];
}
