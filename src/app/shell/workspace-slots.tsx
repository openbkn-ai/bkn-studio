/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { PropsWithChildren, ReactNode } from "react";
import { useContext } from "react";

import { createPortal } from "react-dom";

import { WorkspaceSlotsContext } from "@/app/shell/workspace-slots-context";

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
