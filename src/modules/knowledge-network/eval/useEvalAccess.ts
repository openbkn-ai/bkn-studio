/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { getEvalCapabilities } from "./m0-run.service";

export type EvalAccessStatus = "loading" | "allowed" | "denied" | "failed";

// The server decides creator/full-permission admission. Do not reproduce the
// permission registry in Studio or assume that view_detail grants Eval access.
export function useEvalAccess(networkId: string) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ networkId: string; status: EvalAccessStatus }>({
    networkId: "",
    status: "loading",
  });
  useEffect(() => {
    let active = true;
    if (!networkId) return;
    setState({ networkId, status: "loading" });
    void getEvalCapabilities(networkId).then(
      () => {
        if (active) setState({ networkId, status: "allowed" });
      },
      (error: unknown) => {
        if (active)
          setState({
            networkId,
            status: isAxiosError(error) && error.response?.status === 403 ? "denied" : "failed",
          });
      },
    );
    return () => {
      active = false;
    };
  }, [networkId, revision]);
  return {
    status: state.networkId === networkId ? state.status : ("loading" as EvalAccessStatus),
    retry: () => setRevision((value) => value + 1),
  };
}
