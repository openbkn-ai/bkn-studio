/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import axios from "axios";
import type { TFunction } from "i18next";

import { extractRequestErrorDetail } from "@/modules/execution-factory/utils/request-error-detail";
import type {
  ImpexComponentType,
  ImpexImportMode,
} from "@/modules/execution-factory/types/impex";

export type ImpexUserErrorMessage = {
  title: string;
  hint?: string;
};

function isResourceConflict(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  if (error.response?.status === 409) {
    return true;
  }

  const detail = extractRequestErrorDetail(error);
  return Boolean(
    detail.code?.includes("Conflict") ||
      detail.code?.includes("ResourceIDConflict") ||
      detail.code?.includes("ToolExists") ||
      detail.code?.includes("OperatorExists"),
  );
}

function componentTypeKey(componentType: ImpexComponentType) {
  if (componentType === "toolbox") {
    return "toolbox";
  }
  if (componentType === "mcp") {
    return "mcp";
  }
  return "operator";
}

export function resolveImpexUserErrorMessage(
  error: unknown,
  options: {
    mode: ImpexImportMode;
    componentType: ImpexComponentType;
    t: TFunction;
  },
): ImpexUserErrorMessage {
  const { mode, componentType, t } = options;
  const detail = extractRequestErrorDetail(error);
  const typeKey = componentTypeKey(componentType);

  if (isResourceConflict(error) && mode === "create") {
    return {
      title: t(`executionFactory.installError.alreadyExists.${typeKey}`),
      hint: t("executionFactory.installError.alreadyExistsHint"),
    };
  }

  if (detail.description && !detail.message.includes("status code")) {
    const skipSolution =
      detail.solution === "请联系管理员" ||
      detail.solution === "Please contact your administrator";
    return {
      title: detail.description,
      hint: detail.solution && !skipSolution ? detail.solution : undefined,
    };
  }

  if (detail.message.includes("status code")) {
    return {
      title: t("executionFactory.installError.generic"),
    };
  }

  return {
    title: detail.message || t("executionFactory.installError.generic"),
  };
}

export function resolveCatalogInstallErrorMessage(
  error: unknown,
  options: {
    mode: ImpexImportMode;
    componentType: ImpexComponentType;
    t: TFunction;
  },
): ImpexUserErrorMessage {
  return resolveImpexUserErrorMessage(error, options);
}
