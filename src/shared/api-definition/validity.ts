/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { createContext, useContext, useEffect, useId } from "react";

export const ValidityContext = createContext<((key: string, valid: boolean) => void) | null>(null);

export function useEditorValidity(valid: boolean) {
  const report = useContext(ValidityContext);
  const id = useId();
  useEffect(() => {
    report?.(id, valid);
    return () => report?.(id, true);
  }, [id, report, valid]);
}
