import { Navigate, useSearchParams } from "react-router-dom";

import type { ExecutionUnitTab } from "@/modules/execution-factory/components/execution-unit/types";

type ExecutionUnitTabRedirectProps = {
  activeTab: ExecutionUnitTab;
  openCreate?: boolean;
};

export function ExecutionUnitTabRedirect({
  activeTab,
  openCreate = false,
}: ExecutionUnitTabRedirectProps) {
  const [searchParams] = useSearchParams();
  const nextParams = new URLSearchParams(searchParams);
  nextParams.set("activeTab", activeTab);

  if (openCreate) {
    nextParams.set("create", "1");
  } else {
    nextParams.delete("create");
  }

  return (
    <Navigate replace to={`/execution-factory/units?${nextParams.toString()}`} />
  );
}
