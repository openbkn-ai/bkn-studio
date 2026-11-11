/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { PropsWithChildren, ReactNode } from "react";
import { useContext, useMemo, useState } from "react";

import { createPortal } from "react-dom";

import { ShellTrailSlotContext, WorkspaceSlotsContext } from "@/app/shell/workspace-slots-context";

export function WorkspaceToolbarPortal({
  children,
  fallback = null,
}: PropsWithChildren<{ fallback?: ReactNode }>) {
  const context = useContext(WorkspaceSlotsContext);

  if (!context?.toolbarHost) {
    return <>{fallback}</>;
  }

  return createPortal(children, context.toolbarHost);
}

/** Renders after the top bar's trail; without a top bar it renders `fallback` in place. */
export function ShellTrailPortal({
  children,
  fallback = null,
}: PropsWithChildren<{ fallback?: ReactNode }>) {
  const context = useContext(ShellTrailSlotContext);

  if (!context?.trailHost) {
    return <>{fallback}</>;
  }

  return createPortal(children, context.trailHost);
}

/**
 * Lets a page add a control after the top bar's trail. Wrap both the TopBar and the page content
 * in it; pages that render their own TopBar outside the console shell need it too.
 */
export function ShellTrailSlotProvider({ children }: PropsWithChildren) {
  const [trailHost, setTrailHost] = useState<HTMLSpanElement | null>(null);
  const value = useMemo(() => ({ setTrailHost, trailHost }), [trailHost]);
  return <ShellTrailSlotContext.Provider value={value}>{children}</ShellTrailSlotContext.Provider>;
}
