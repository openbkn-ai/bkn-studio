/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useRef } from "react";

/**
 * Calls `onSettled` once each time background work the section was reading ends, so the page
 * can read what depends on it again (whether it may publish, for one).
 */
export function useOnSettled(inProgress: boolean, onSettled?: () => void) {
  const wasInProgress = useRef(inProgress);
  useEffect(() => {
    if (wasInProgress.current && !inProgress) {
      onSettled?.();
    }
    wasInProgress.current = inProgress;
  }, [inProgress, onSettled]);
}
