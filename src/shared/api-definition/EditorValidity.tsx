/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { ValidityContext } from "./validity";

export function EditorValidity({
  children,
  onValidityChange,
}: {
  children: ReactNode;
  onValidityChange?: (valid: boolean) => void;
}) {
  const parent = useContext(ValidityContext);
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const report = useCallback((key: string, valid: boolean) => {
    setInvalid((previous) => {
      if (valid === !previous.has(key)) return previous;
      const next = new Set(previous);
      if (valid) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  useEffect(() => {
    if (!parent) onValidityChange?.(invalid.size === 0);
  }, [parent, invalid, onValidityChange]);
  return parent ? (
    children
  ) : (
    <ValidityContext.Provider value={report}>{children}</ValidityContext.Provider>
  );
}
