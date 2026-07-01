/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ReactNode } from "react";

type WorkspaceToolbarProps = {
  actions?: ReactNode;
  filters?: ReactNode;
  meta?: ReactNode;
};

export function WorkspaceToolbar({
  actions,
  filters,
  meta,
}: WorkspaceToolbarProps) {
  return (
    <div className="workspace-toolbar">
      <div className="workspace-toolbar-main">
        {actions ? <div className="workspace-toolbar-group">{actions}</div> : null}
        {meta ? <div className="workspace-toolbar-meta">{meta}</div> : null}
      </div>
      {filters ? <div className="workspace-toolbar-group">{filters}</div> : null}
    </div>
  );
}
