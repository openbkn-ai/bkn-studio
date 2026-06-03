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
