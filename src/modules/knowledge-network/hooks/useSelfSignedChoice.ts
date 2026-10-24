/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { McpConnectionProtocol } from "@/modules/knowledge-network/services/mcp-client-config";

/**
 * Whether the guide assumes a self-signed certificate. Ticked by default when the
 * address looks like one (an IP or `.local` host over https) until the user
 * chooses; never on for plain http, where there is no certificate at all.
 */
export function useSelfSignedChoice(
  likelySelfSigned: boolean,
  protocol: McpConnectionProtocol,
): [boolean, (checked: boolean) => void] {
  const chosen = useRef(false);
  const [allow, setAllow] = useState(protocol === "https" && likelySelfSigned);

  useEffect(() => {
    if (protocol === "http") {
      setAllow(false);
    } else if (!chosen.current) {
      setAllow(likelySelfSigned);
    }
  }, [likelySelfSigned, protocol]);

  const choose = useCallback((checked: boolean) => {
    chosen.current = true;
    setAllow(checked);
  }, []);

  return [allow, choose];
}
