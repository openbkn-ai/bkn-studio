/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { downloadComponentExport } from "@/modules/execution-factory/services/impex.service";
import type { ImpexComponentType } from "@/modules/execution-factory/types/impex";
import { extractRequestErrorDetail } from "@/modules/execution-factory/utils/request-error-detail";

export function useImpexExport() {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [exportingKey, setExportingKey] = useState<string | null>(null);

  const exportComponentById = useCallback(
    async (type: ImpexComponentType, id: string, displayName?: string) => {
      const key = `${type}:${id}`;
      setExportingKey(key);

      try {
        await downloadComponentExport(type, id, displayName);
        void message.success(t("executionFactory.exportSuccess"));
      } catch (error) {
        const detail = extractRequestErrorDetail(error);
        void message.error(detail.description ?? detail.message);
      } finally {
        setExportingKey((current) => (current === key ? null : current));
      }
    },
    [message, t],
  );

  const isExporting = useCallback(
    (type: ImpexComponentType, id: string) => exportingKey === `${type}:${id}`,
    [exportingKey],
  );

  return { exportComponentById, isExporting };
}
