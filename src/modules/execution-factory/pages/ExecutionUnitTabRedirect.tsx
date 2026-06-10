import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import type { ExecutionUnitTab } from "@/modules/execution-factory/components/execution-unit/types";

type ExecutionUnitTabRedirectProps = {
  activeTab: ExecutionUnitTab;
  migrationFrom?: string;
  openCreate?: boolean;
};

export function ExecutionUnitTabRedirect({
  activeTab,
  migrationFrom,
  openCreate = false,
}: ExecutionUnitTabRedirectProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const nextParams = new URLSearchParams(searchParams);
  nextParams.set("activeTab", activeTab);

  if (openCreate) {
    nextParams.set("create", "1");
  } else {
    nextParams.delete("create");
  }

  useEffect(() => {
    if (!migrationFrom) {
      return;
    }

    const storageKey = `execution-factory:url-migration:${migrationFrom}`;
    if (sessionStorage.getItem(storageKey)) {
      return;
    }

    sessionStorage.setItem(storageKey, "1");
    void message.info(t("executionFactory.routeMigrated"));
  }, [location.pathname, message, migrationFrom, t]);

  return (
    <Navigate replace to={`/execution-factory/units?${nextParams.toString()}`} />
  );
}
