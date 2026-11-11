/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { PropsWithChildren, ReactNode } from "react";
import { useContext, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { KnVersionSlotContext } from "@/modules/knowledge-network/components/versions/kn-version-slot-context";

import styles from "./KnVersions.module.css";

/** Wraps the workspace so the version picker can sit beside the network's title. */
export function KnVersionSlotProvider({ children }: PropsWithChildren) {
  const [host, setHost] = useState<HTMLSpanElement | null>(null);
  const value = useMemo(() => ({ host, setHost }), [host]);
  return <KnVersionSlotContext.Provider value={value}>{children}</KnVersionSlotContext.Provider>;
}

/** Placed right after the network's title. */
export function KnVersionSlotHost() {
  const context = useContext(KnVersionSlotContext);
  return <span className={styles.titleSlot} ref={context?.setHost} />;
}

/** Renders beside the network's title when one is on screen, otherwise `fallback`. */
export function KnVersionSlotPortal({
  children,
  fallback = null,
}: PropsWithChildren<{ fallback?: ReactNode }>) {
  const context = useContext(KnVersionSlotContext);
  if (!context?.host) {
    return <>{fallback}</>;
  }
  return createPortal(children, context.host);
}
