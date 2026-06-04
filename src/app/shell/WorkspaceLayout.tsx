import type { PropsWithChildren } from "react";

import { useMemo, useState } from "react";
import { useMatches } from "react-router-dom";

import type { AppRouteHandle } from "@/app/shell/route-meta";
import { WorkspaceSlotsContext } from "@/app/shell/workspace-slots-context";

export function WorkspaceLayout({ children }: PropsWithChildren) {
  const matches = useMatches();
  const [toolbarHost, setToolbarHost] = useState<HTMLDivElement | null>(null);
  const routeHandle = matches[matches.length - 1]?.handle as AppRouteHandle | undefined;
  const hasToolbar = useMemo(() => Boolean(routeHandle?.console), [routeHandle?.console]);

  return (
    <WorkspaceSlotsContext.Provider value={{ toolbarHost }}>
      <div className="workspace-shell">
        {hasToolbar ? <div className="workspace-toolbar-host" ref={setToolbarHost} /> : null}
        <div className={hasToolbar ? "workspace-content" : "workspace-content is-standalone"}>
          {children}
        </div>
      </div>
    </WorkspaceSlotsContext.Provider>
  );
}
