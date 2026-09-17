/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useState } from "react";

import { useAppServices } from "@/framework/context/use-app-services";
import { hasPermissions } from "@/framework/permission/has-permissions";
import { getResourceOperations } from "@/modules/model-resources/services/authorization.service";

export type FunctionCodeAccess = {
  /** Ad-hoc runs and schema inference over unsaved code. */
  canExecuteAdhoc: boolean;
  /** AI code generation. */
  canGenerate: boolean;
};

/**
 * Access to the standalone Function code endpoints, independent of the page that hosts the editor.
 *
 * AI generation authorizes type-level `function:create`. Ad-hoc runs and schema inference authorize
 * the reserved `function/adhoc` resource: Function-set grants are aggregated into `function:debug`
 * for navigation, so that point only decides whether the exact scoped check is worth asking for.
 * Operator grants cover neither endpoint, so legacy operator forms must use this too.
 */
export function useFunctionCodeAccess(): FunctionCodeAccess {
  const { runtimeConfig } = useAppServices();
  const currentPermissions = runtimeConfig.currentUser.permissions;
  const canGenerate = hasPermissions({
    currentPermissions,
    requiredPermissions: "execution-factory:function:create",
  });
  const mayExecute = hasPermissions({
    currentPermissions,
    requiredPermissions: "execution-factory:function:debug",
  });
  const [canExecuteAdhoc, setCanExecuteAdhoc] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!mayExecute) {
      setCanExecuteAdhoc(false);
      return;
    }

    void getResourceOperations([{ type: "function", id: "adhoc" }])
      .then((operations) => {
        if (!cancelled) {
          setCanExecuteAdhoc(operations[0]?.operation?.includes("execute") ?? false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCanExecuteAdhoc(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mayExecute]);

  return { canExecuteAdhoc, canGenerate };
}
